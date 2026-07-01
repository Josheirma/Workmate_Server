import { Request, Response, NextFunction } from "express"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateActivationInput(req: Request, res: Response, next: NextFunction) {
  const { username, email_address, time_stamp, product_type, proofofpurchase } = req.body

  if (!username || !email_address || !time_stamp || !product_type || !proofofpurchase)
    return res.status(400).json({ success: false, error: "missing fields" })

  if (typeof email_address !== "string" || email_address.length > 254 || !EMAIL_RE.test(email_address))
    return res.status(400).json({ success: false, error: "invalid email" })

  if (typeof username !== "string" || username.trim().length === 0 || username.length > 100)
    return res.status(400).json({ success: false, error: "invalid username" })

  if (product_type !== "box" && product_type !== "online")
    return res.status(400).json({ success: false, error: "invalid product_type" })

  next()
}
