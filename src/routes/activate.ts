import { Request, Response } from "express"
import pool from "../db/pool"
import { signLicense } from "../utils/sign"

export async function activateLicense(req: Request, res: Response) {
  const { serial, machineID, email } = req.body
  const ip = req.ip
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    // FOR UPDATE row-locks the serial so two concurrent requests can't both
    // read used=false and both succeed.
    const { rows } = await client.query(
      `SELECT id, used, version FROM serials WHERE serial=$1 FOR UPDATE`,
      [serial]
    )

    const record = rows[0]
    const valid  = record && !record.used
    const reason = !record ? "invalid serial" : record.used ? "serial already used" : null

    await client.query(
      `INSERT INTO activation_logs (serial, machine_id, ip_address, success, reason)
       VALUES ($1,$2,$3,$4,$5)`,
      [serial, machineID, ip, valid, reason]
    )

    if (!valid) {
      await client.query("COMMIT")
      return res.status(400).json({ success: false, error: reason })
    }

    // AND version=$4 — if the row changed between our SELECT and UPDATE,
    // rowCount is 0 and we return a 409 instead of double-activating.
    const result = await client.query(
      `UPDATE serials
          SET used=true, machine_id=$1, activated_at=NOW(), email=$2, version=version+1
        WHERE serial=$3 AND version=$4`,
      [machineID, email ?? null, serial, record.version]
    )

    if (result.rowCount === 0) {
      await client.query("ROLLBACK")
      return res.status(409).json({ success: false, error: "conflict — please retry" })
    }

    await client.query("COMMIT")

    const signature = signLicense(serial, machineID)
    return res.json({ success: true, license: { serial, machineID, signature } })

  } catch (err) {
    await client.query("ROLLBACK")
    console.error("[activate]", err)
    return res.status(500).json({ success: false, error: "activation failed" })
  } finally {
    client.release()
  }
}
