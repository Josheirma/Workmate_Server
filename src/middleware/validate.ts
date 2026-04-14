import { Request, Response, NextFunction } from "express"

const SERIAL_RE = /^WM-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/
const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateActivationInput(req: Request, res: Response, next: NextFunction) {
  const { serial, machineID, email } = req.body

  if (!serial || !machineID)
    return res.status(400).json({ success: false, error: "missing fields" })

  if (!SERIAL_RE.test(serial))
    return res.status(400).json({ success: false, error: "invalid serial format" })

  // machineID: non-empty string, max 64 chars, no control characters
  if (typeof machineID !== "string" || machineID.length > 64 || /[\x00-\x1F]/.test(machineID))
    return res.status(400).json({ success: false, error: "invalid machineID" })

  // email: optional, but validated if present
  if (email != null && (typeof email !== "string" || email.length > 254 || !EMAIL_RE.test(email)))
    return res.status(400).json({ success: false, error: "invalid email" })

  next()
}
