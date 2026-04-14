// src/workers/emailRetry.ts
//
// Runs on a 10-second interval. Finds online serials where the license email
// was not successfully sent (email_sent = false) and retries.
//
// A row qualifies for retry if:
//   - type = 'online'       → was purchased, not a box serial
//   - email IS NOT NULL     → we have somewhere to send it
//   - email_sent = false    → send has not succeeded yet
//   - created_at > 1hr ago  → ignore very fresh rows still in-flight
//     (gives the original send a chance to complete before we retry)
//
// Wired into index.ts via startEmailRetryWorker().

import pool from "../db/pool"
import { sendLicenseEmail } from "../utils/mailer"

const INTERVAL_MS  = 10 * 1000   // check every 10 seconds
const MIN_AGE_MINS = 5            // don't retry rows younger than 5 minutes
const MAX_RETRIES  = 10           // stop retrying after this many attempts (prevents infinite loop on bad email)

export function startEmailRetryWorker() {
  console.log("[emailRetry] worker started")
  setInterval(run, INTERVAL_MS)
}

async function run() {
  let rows: any[]

  try {
    const result = await pool.query(
      `SELECT serial, email, retry_count
         FROM serials
        WHERE type        = 'online'
          AND email       IS NOT NULL
          AND email_sent  = false
          AND retry_count < $1
          AND created_at  < NOW() - ($2 || ' minutes')::INTERVAL
        LIMIT 10`,
      [MAX_RETRIES, MIN_AGE_MINS]
    )
    rows = result.rows
  } catch (err) {
    console.error("[emailRetry] DB query failed:", err)
    return
  }

  if (rows.length === 0) return

  console.log(`[emailRetry] ${rows.length} unsent serial(s) found`)

  for (const row of rows) {
    try {
      await sendLicenseEmail(row.email, row.serial)

      // Mark sent
      await pool.query(
        `UPDATE serials
            SET email_sent  = true,
                retry_count = retry_count + 1
          WHERE serial = $1`,
        [row.serial]
      )
      console.log(`[emailRetry] sent — serial=${row.serial}`)

    } catch (err) {
      // Increment retry_count even on failure so we don't retry forever
      await pool.query(
        `UPDATE serials SET retry_count = retry_count + 1 WHERE serial = $1`,
        [row.serial]
      ).catch(() => {}) // swallow — don't let a counter update crash the loop

      console.error(`[emailRetry] failed — serial=${row.serial} attempt=${row.retry_count + 1}`, err)
    }
  }
}
