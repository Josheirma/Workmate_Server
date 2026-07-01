// src/workers/emailRetry.ts
//
// Runs every 10 seconds. Finds serials where email_sent = false and retries.
// Only rows inserted with proofofpurchase "1111" will have email_sent = false
// (others are never queued for email).

import pool from "../db/pool"
import { sendLicenseEmail } from "../utils/mailer"

const INTERVAL_MS = 10 * 1000

export function startEmailRetryWorker() {
  console.log("[emailRetry] worker started")
  setInterval(run, INTERVAL_MS)
}

async function run() {
  let rows: any[]

  try {
    const result = await pool.query(
      `SELECT id, email_address FROM serials WHERE email_sent = false LIMIT 10`
    )
    rows = result.rows
  } catch (err) {
    console.error("[emailRetry] DB query failed:", err)
    return
  }

  if (rows.length === 0) return

  console.log(`[emailRetry] ${rows.length} unsent email(s) found`)

  for (const row of rows) {
    try {
      await sendLicenseEmail(row.email_address, String(row.id))
      await pool.query(`UPDATE serials SET email_sent = true WHERE id = $1`, [row.id])
      console.log(`[emailRetry] sent — id=${row.id}`)
    } catch (err) {
      console.error(`[emailRetry] failed — id=${row.id}`, err)
    }
  }
}
