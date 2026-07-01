import { Request, Response } from "express"
import pool from "../db/pool"
import { sendLicenseEmail } from "../utils/mailer"

// POST /activate
// Body: { username, email_address, time_stamp, product_type, proofofpurchase }

export async function activateLicense(req: Request, res: Response) {
  const { username, email_address, time_stamp, product_type, proofofpurchase } = req.body

  try {
    const existing = await pool.query(
      `SELECT id FROM serials WHERE email_address = $1`,
      [email_address.toLowerCase().trim()]
    )

    if (existing.rows.length > 0) {
      return res.json({ success: true })
    }

    const result = await pool.query(
      `INSERT INTO serials (username, email_address, time_stamp, product_type, email_sent)
       VALUES ($1, $2, $3, $4, false) RETURNING id`,
      [username.trim(), email_address.toLowerCase().trim(), time_stamp, product_type]
    )

    const id = result.rows[0].id
    console.log(`[activate] new serial saved — id=${id} email=${email_address}`)

    // Send email immediately if proof code is "1111"
    if (proofofpurchase === "1111") {
      try {
        await sendLicenseEmail(email_address.toLowerCase().trim(), String(id))
        await pool.query(`UPDATE serials SET email_sent = true WHERE id = $1`, [id])
        console.log(`[activate] email sent — id=${id}`)
      } catch (err) {
        console.error(`[activate] email failed, will retry — id=${id}`, err)
        // email_sent stays false; emailRetry worker will pick it up
      }
    }

    return res.json({ success: true })

  } catch (err) {
    console.error("[activate]", err)
    return res.status(500).json({ success: false, error: "activation failed" })
  }
}
