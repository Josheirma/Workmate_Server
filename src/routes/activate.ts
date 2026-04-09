// src/routes/activate.ts
import { Request, Response } from "express"
import pool from "../db/pool"
import { signLicense } from "../utils/sign"

export async function activateLicense(req: Request, res: Response) {
  const { serial, machineID, email } = req.body   // ← add email
  const ip = req.ip

  try {
    const { rows } = await pool.query(
      `SELECT * FROM serials WHERE serial = $1`,
      [serial]
    )

    const record = rows[0]
    const valid  = record && !record.used
    const reason = !record ? "invalid serial" : record.used ? "serial already used" : null

    await pool.query(
      `INSERT INTO activation_logs (serial, machine_id, ip_address, success, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [serial, machineID, ip, valid, reason]
    )

    if (!valid)
      return res.json({ success: false, error: reason })

    // mark as used + save email
    await pool.query(
      `UPDATE serials
       SET used=true, machine_id=$1, activated_at=NOW(), email=$2
       WHERE serial=$3`,
      [machineID, email  || null, serial]   // ← email saved here
    )

    const signature = signLicense(serial, machineID)

    res.json({
      success: true,
      license: { serial, machineID, signature }
    })

  } catch (err) {
    console.error("ACTIVATION ERROR:", err)
    res.json({ success: false, error: "activation failed" })
  }
}