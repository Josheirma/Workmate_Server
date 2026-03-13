import { Request, Response } from "express"
import { generateOnlineSerial } from "../utils/serial"

export async function purchaseSerial(req: Request, res: Response) {
  
  console.log("Purchase route hit")
  const { email } = req.body
   console.log("Component rendered2!", email)
  if (!email)
    return res.json({ success: false, error: "email required" })

  console.log("Component rendered3!", email)

  // basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.json({ success: false, error: "invalid email" })
  console.log(`Processing purchase for ${email}`)
  try {
    // assume payment verified before this point
    const serial = await generateOnlineSerial(email)
    console.log(`Generated serial ${serial} for ${email}`)
    // TODO: plug in your email service here
    // await sendEmail(email, serial)

    res.json({
      success: true,
      message: "Serial sent to your email"
    })

  } catch (err) {
    console.error(err)
    res.json({ success: false, error: "purchase failed" })
  }
}