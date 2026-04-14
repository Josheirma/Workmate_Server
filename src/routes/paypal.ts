import { Request, Response, Router } from "express"
import pool from "../db/pool"
import { generateOnlineSerial } from "../utils/serial"
import { sendLicenseEmail } from "../utils/mailer"
import { idempotencyGuard } from "../middleware/idempotency"

const router = Router()

const PAYPAL_API = process.env.NODE_ENV === "production"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com"

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID as string
const SECRET    = process.env.PAYPAL_SECRET    as string

// Cache the access token — valid ~9 hrs, refresh 5 min before expiry.
// Avoids a redundant auth round-trip on every request.
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

// ─── Create Order — no idempotency needed, PayPal handles it ─────────────────
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

// ─── Capture Order — idempotency guard prevents duplicate serials on retries ──
router.post("/api/paypal/capture-order", idempotencyGuard, async (req: Request, res: Response) => {
  const { orderID, email } = req.body
  const finalize = res.locals.finalizeIdempotency

  // Step 1: verify payment with PayPal
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

  // Step 2: resolve email
  const buyerEmail = email || capture.payment_source?.paypal?.email_address || capture.payer?.email_address
  if (!buyerEmail) {
    console.error("[paypal/capture] no email found on order", orderID)
    const body = { success: true, warning: "Payment captured but no email found" }
    await finalize("complete", body)
    return res.json(body)
  }

  // Step 3: issue serial exactly once — DB is source of truth
  // Check paypal_order_id first (UNIQUE column) as a second safety net
  // on top of the idempotency middleware.
  let serial: string
  try {
    const existing = await pool.query(`SELECT serial FROM serials WHERE paypal_order_id=$1`, [orderID])
    serial = existing.rows.length > 0
      ? existing.rows[0].serial
      : await generateOnlineSerial(buyerEmail, orderID)
  } catch (err) {
    console.error("[paypal/serial]", err)
    const body = { error: "Failed to issue license" }
    await finalize("failed", body)
    return res.status(500).json(body)
  }

  // Step 4: email (non-fatal — serial is safe in DB, retry worker picks it up if this fails)
  try {
    await sendLicenseEmail(buyerEmail, serial)
    // Mark sent so the retry worker skips this row
    await pool.query(
      `UPDATE serials SET email_sent = true WHERE serial = $1`,
      [serial]
    )
  } catch (err) {
    // email_sent stays false — retry worker will re-attempt every 10 seconds
    console.error(`[paypal/email] orderID=${orderID}`, err)
  }

  const body = { success: true, serial }
  await finalize("complete", body)
  return res.json(body)
})

export default router
