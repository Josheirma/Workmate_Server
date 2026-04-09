// import { Request, Response } from "express";

// eexport async function purchaseSerial(req: Request, res: Response) {
//   const { email } = req.body

//   try {
//     const serial = await generateOnlineSerial(email)
//     // TODO: await sendEmail(email, serial)
//     res.json({ success: true, message: "Serial sent to your email" })
//   } catch (err) {
//     console.error(err)
//     res.status(500).json({ success: false, error: "purchase failed" })
//   }
// }