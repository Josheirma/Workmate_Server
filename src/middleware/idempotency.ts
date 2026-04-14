// src/middleware/idempotency.ts
//
// Deduplicates PayPal capture-order retries at the DB level.
//
// Flow:
//   INSERT 'pending' row keyed on orderID.
//   → Succeeds   : first time we've seen this key — proceed, attach finalizeIdempotency()
//   → Conflicts  : key exists — replay cached response (complete/failed) or return 409 (pending)
//
// The route calls finalizeIdempotency("complete"|"failed", body) at every exit path
// to flip the row and cache the response for future replays.

import { Request, Response, NextFunction } from "express"
import pool from "../db/pool"

declare module "express-serve-static-core" {
  interface Locals {
    idempotencyKey: string
    finalizeIdempotency: (status: "complete" | "failed", body: object) => Promise<void>
  }
}

export async function idempotencyGuard(req: Request, res: Response, next: NextFunction) {
  const key = req.body?.orderID as string | undefined
  if (!key) return res.status(400).json({ error: "orderID required" })

  try {
    await pool.query(
      `INSERT INTO idempotency_keys (key, status) VALUES ($1, 'pending')`,
      [key]
    )
    res.locals.idempotencyKey = key
    res.locals.finalizeIdempotency = async (status: "complete" | "failed", body: object) => {
      await pool.query(
        `UPDATE idempotency_keys SET status=$1, response_body=$2 WHERE key=$3`,
        [status, JSON.stringify(body), key]
      )
    }
    return next()
  } catch (err: any) {
    if (err.code === "23505") {
      const { rows } = await pool.query(
        `SELECT status, response_body FROM idempotency_keys WHERE key=$1`,
        [key]
      )
      const row = rows[0]
      if (!row) return next()
      if (row.status === "complete" || row.status === "failed")
        return res.status(200).json(row.response_body)
      return res.status(409).json({ error: "order is currently being processed — please wait" })
    }
    console.error("[idempotency]", err)
    return res.status(500).json({ error: "internal error" })
  }
}
