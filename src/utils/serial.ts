import { Request, Response, Router } from "express"
import pool from "../db/pool"
// import { generateOnlineSerial } from "../utils/serial"
import { sendLicenseEmail } from "../utils/mailer"
import { idempotencyGuard } from "../middleware/idempotency"

const router = Router()

const PAYPAL_API = process.env.NODE_ENV === "production"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com"

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID as string
const SECRET    = process.env.PAYPAL_SECRET    as string

let cachedToken:    string | null = null
let tokenExpiresAt: number        = 0

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) return cachedToken
  const res  = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${SECRET}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
  })
  const data = await res.json()
  if (!data.access_token) throw new Error("PayPal auth failed")
  cachedToken    = data.access_token
  tokenExpiresAt = Date.now() + (data.expires_in ?? 32400) * 1000
  return cachedToken!
}

// ─── Create Order ─────────────────────────────────────────────────────────────
router.post("/api/paypal/create-order", async (req: Request, res: Response) => {
  try {
    const token = await getAccessToken()
    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{ amount: { currency_code: "USD", value: "59.99" }, description: "WorkMate License" }],
        application_context: { shipping_preference: "NO_SHIPPING" },
      }),
    })
    const order = await response.json()
    res.json({ id: order.id })
  } catch (err) {
    console.error("[paypal/create-order]", err)
    res.status(500).json({ error: "Failed to create order" })
  }
})

// ─── Capture Order ────────────────────────────────────────────────────────────
router.post("/api/paypal/capture-order", idempotencyGuard, async (req: Request, res: Response) => {
  const { orderID, email: bodyEmail } = req.body
  const finalize = res.locals.finalizeIdempotency

  let capture: any
  try {
    const token = await getAccessToken()
    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    })
    capture = await response.json()
  } catch (err) {
    const body = { error: "PayPal capture failed" }
    console.error("[paypal/capture]", err)
    await finalize("failed", body)
    return res.status(502).json(body)
  }

  if (capture.status !== "COMPLETED") {
    const body = { error: "Payment not completed" }
    await finalize("failed", body)
    return res.status(400).json(body)
  }

  const buyerEmail = bodyEmail
    || capture.payment_source?.paypal?.email_address
    || capture.payer?.email_address

  if (!buyerEmail) {
    console.error("[paypal/capture] no email found on order", orderID)
    const body = { success: true, warning: "Payment captured but no email found" }
    await finalize("complete", body)
    return res.json(body)
  }

  // serial generation disabled for now — hardcoded for testing
  // const payerName = capture.payer?.name
  // const buyerUserId = payerName
  //   ? `${payerName.given_name ?? ""} ${payerName.surname ?? ""}`.trim()
  //   : buyerEmail.split("@")[0]
  // serial = await generateOnlineSerial(buyerEmail, buyerUserId)

  const serial = "2222"

  // Attempt immediate send — if it fails, email_sent stays false and retry worker picks it up
  try {
    await sendLicenseEmail(buyerEmail, serial)
    const id = parseInt(serial, 10)
    await pool.query(`UPDATE serials SET email_sent = true WHERE id = $1`, [id])
  } catch (err) {
    console.error(`[paypal/email] orderID=${orderID}`, err)
  }

  const body = { success: true, serial }
  await finalize("complete", body)
  return res.json(body)
})

export default router