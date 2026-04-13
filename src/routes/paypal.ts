import { Request, Response, Router } from "express"
import { generateOnlineSerial } from "../utils/serial"
import { sendLicenseEmail } from "../utils/mailer"

const router = Router()

// PayPal sandbox API base URL — change to live when ready:
// "https://api-m.paypal.com"
const PAYPAL_API = "https://api-m.sandbox.paypal.com"

// credentials from .env file — never hardcode these
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID as string
const SECRET    = process.env.PAYPAL_SECRET as string

// ─── Helper: get a temporary access token from PayPal ────────────────────────
// PayPal doesn't let you call its API directly with CLIENT_ID + SECRET
// you first swap them for a short-lived access token, then use that
async function getAccessToken(): Promise<string> {
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // Basic Auth — CLIENT_ID:SECRET encoded to base64 (standard format PayPal expects)
      Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${SECRET}`).toString("base64"),
    },
    // tells PayPal we're a server authenticating directly (not on behalf of a user)
    body: "grant_type=client_credentials",
  })
  const data = await res.json()
  return data.access_token // short-lived token, valid for ~9 hours
}

// ─── Route 1: Create Order ────────────────────────────────────────────────────
// called when user clicks the PayPal button
// creates a pending order in PayPal and returns its ID
// the PayPal button uses the ID to open the payment popup
router.post("/api/paypal/create-order", async (req: Request, res: Response) => {
  try {
    const accessToken = await getAccessToken()

    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`, // use the token we just got
      },
      body: JSON.stringify({
        intent: "CAPTURE", // means "charge the card immediately" (vs authorize only)
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: "59.99", // price shown to user in PayPal popup
            },
            description: "WorkMate License", // shown on PayPal receipt
          },
        ],
        application_context: {
          //!!!!
          shipping_preference: "NO_SHIPPING", // hides shipping address field (digital product)
        },
      }),
    })

    const order = await response.json()
    res.json({ id: order.id }) // send order ID back to frontend so PayPal button can open popup
  } catch (err) {
    console.error("PayPal create-order error:", err)
    res.status(500).json({ error: "Failed to create PayPal order" })
  }
})

// ─── Route 2: Capture Order ───────────────────────────────────────────────────
// called after user approves payment in the PayPal popup
// "capture" means actually charge the money
// then we generate a license serial and email it to the buyer
router.post("/api/paypal/capture-order", async (req: Request, res: Response) => {
  const { orderID, email } = req.body // orderID from PayPal, email optionally from frontend

  if (!orderID) {
    res.status(400).json({ error: "orderID required" })
    return
  }

  try {
    const accessToken = await getAccessToken()

    // tell PayPal to finalize the payment and charge the buyer
    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const capture = await response.json()

    // make sure payment actually went through before doing anything
    if (capture.status !== "COMPLETED") {
      res.status(400).json({ error: "Payment not completed", details: capture })
      return
    }

    // try to get buyer email — first from frontend, then from PayPal's response
    // PayPal returns it in different places depending on payment method
    const buyerEmail =
      email ||
      capture.payment_source?.paypal?.email_address || // paid with PayPal account
      capture.payer?.email_address                     // fallback

    if (!buyerEmail) {
      // payment went through but we couldn't find an email — log and continue
      console.error("No email found on capture:", JSON.stringify(capture))
      res.status(200).json({ success: true, warning: "Payment captured but no email found" })
      return
    }

    // generate a unique license serial and save it to the database
    const serial = await generateOnlineSerial(buyerEmail)

    // email the serial to the buyer
    await sendLicenseEmail(buyerEmail, serial)

    console.log(`PayPal purchase complete — email: ${buyerEmail}, serial: ${serial}`)
    res.json({ success: true, serial })
  } catch (err) {
    console.error("PayPal capture-order error:", err)
    res.status(500).json({ error: "Failed to capture PayPal order" })
  }
})

export default router