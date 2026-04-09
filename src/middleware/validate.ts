import { Request, Response, NextFunction } from "express"

export function validateActivationInput(req: Request, res: Response, next: NextFunction) {
  const { serial, machineID } = req.body

  if (!serial || !machineID)
    return res.status(400).json({ success: false, error: "missing fields" })

  if (!/^WM-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(serial))
    return res.status(400).json({ success: false, error: "invalid serial format" })

  next()
}
