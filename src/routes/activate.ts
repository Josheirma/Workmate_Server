import { Request, Response } from "express"
import pool from "../db/pool"
import { sendLicenseEmail } from "../utils/mailer"

// POST /activate
// Body: { username, email_address, time_stamp, product_type, proofofpurchase }
// Note: username/email_address in the body are only used for the "box" path.
// For "online", username/email_address already exist on the row from
// PayPal's capture-order route — we use that stored data, not the request body.

export async function activateLicense(req: Request, res: Response) {
  
  const { username, email_address, time_stamp, product_type, proofofpurchase } = req.body

  console.log("!!!!: ", username, email_address, time_stamp, product_type, proofofpurchase)
  const code  = String(proofofpurchase ?? "").trim()
  const email = String(email_address ?? "").toLowerCase().trim()
  const name  = String(username ?? "").trim()

  const validPair =
    (product_type === "box"    && code === "1111") ||
    (product_type === "online" && code === "2222")

  if (!validPair) {
    return res.json({ success: false, error: "Invalid activation code" })
  }

  try {

    
    // console.log("!!: ", product_type);
    // console.log(code)
    if (product_type === "box") {
      if (!email || !name) {
        return res.json({ success: false, error: "Username and email are required to activate" })
      }

      // Always insert a new row — same email can activate multiple times,
      // each activation is its own row, identified by its own id.
      const insertResult = await pool.query(
        `INSERT INTO serials (username, email_address, time_stamp, product_type, email_sent, activated)
         VALUES ($1, $2, $3, $4, false, true)
         RETURNING id`,
        [name, email, time_stamp, product_type]
      )

      const id = insertResult.rows[0].id
      console.log(`[activate] new box serial saved — id=${id} email=${email}`)

      try {
        await sendLicenseEmail(email, String(id))
        await pool.query(`UPDATE serials SET email_sent = true WHERE id = $1`, [id])
      } catch (err) {
        console.error(`[activate] email failed, will retry — id=${id}`, err)
      }

      return res.json({ success: true })
    }

    // product_type === "online" — row already exists from PayPal's capture-order route,
    // already populated with the real buyer's username/email_address.
    // Just claim the oldest unclaimed paid row — don't touch its username/email.
    const claim = await pool.query(
      `UPDATE serials
       SET activated = true
       WHERE id = (
         SELECT id FROM serials
         WHERE product_type = 'online' AND email_sent = true AND activated = false
         ORDER BY id ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, username, email_address`,
      []
    )

    if (claim.rows.length === 0) {
      return res.json({ success: false, error: "No available online license to activate" })
    }

    const claimed = claim.rows[0]
    console.log(`[activate] online license claimed — id=${claimed.id} email=${claimed.email_address}`)
    return res.json({ success: true, username: claimed.username, email: claimed.email_address })

  } catch (err) {
    console.error("[activate]", err)
    return res.status(500).json({ success: false, error: "activation failed" })
  }
}