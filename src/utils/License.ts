import express, { Request, Response, Router, RequestHandler } from "express";
import Stripe from "stripe";
import pg from "pg";
import { randomUUID } from "crypto";
import { Resend } from "resend";
console.log("at license")
const router: Router = express.Router();

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    pool.query(`
      CREATE TABLE IF NOT EXISTS licenses (
        id                SERIAL PRIMARY KEY,
        email             TEXT NOT NULL,
        license_key       TEXT NOT NULL UNIQUE,
        stripe_session_id TEXT NOT NULL UNIQUE,
        created_at        TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(console.error);
  }
  return pool;
}

function generateLicenseKey(): string {
  return randomUUID()
    .toUpperCase()
    .replace(/-/g, "")
    .match(/.{4}/g)!
    .join("-");
}

// ─── Route 1: Create Stripe Checkout Session ─────────────────────────────────

router.post(
  "/api/create-checkout-session",
  async (req: Request, res: Response): Promise<void> => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{ price: process.env.STRIPE_PRICE_ID as string, quantity: 1 }],
        mode: "payment",
        billing_address_collection: "auto",
        success_url: `${process.env.APP_URL}/success`,
        cancel_url: `${process.env.APP_URL}/cancel`,
      });
      res.json({ url: session.url });
    } catch (err) {
      console.error("FULL STRIPE ERROR:", JSON.stringify(err, null, 2));  // ← already there
      console.log("PRICE ID:", process.env.STRIPE_PRICE_ID);              // ← add this
      console.log("APP_URL:", process.env.APP_URL);                       // ← add this
      res.status(500).json({ error: "Failed to create checkout session.", detail: (err as any).message });
    }
  }
);

// ─── Route 2: Stripe Webhook ──────────────────────────────────────────────────

router.post(
  "/api/stripe-webhook",
  express.raw({ type: "application/json" }) as RequestHandler,
  async (req: Request, res: Response): Promise<void> => {
    console.log("hit checkout route");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
    const resend = new Resend(process.env.RESEND_API_KEY as string);
    const sig = req.headers["stripe-signature"] as string;
    console.log("hit checkout route2");
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET as string
      );
    } catch (err) {
      console.error("Webhook signature error:", (err as Error).message);
      res.status(400).send(`Webhook Error: ${(err as Error).message}`);
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.customer_details?.email ?? session.customer_email;

      if (!email) {
        console.error("No email on session:", session.id);
        res.status(200).send();
        return;
      }

      const licenseKey = generateLicenseKey();

      try {
        await getPool().query(
          `INSERT INTO licenses (email, license_key, stripe_session_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (stripe_session_id) DO NOTHING`,
          [email, licenseKey, session.id]
        );
        console.log(`License saved — email: ${email}, key: ${licenseKey}`);

        const { data, error } = await resend.emails.send({
          from: "onboarding@resend.dev",
          to: "joshuaeirm@gmail.com",
          subject: "Your WorkMate License Key",
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
              <h2>Thank you for purchasing WorkMate!</h2>
              <p>Your license key is:</p>
              <div style="font-family: monospace; font-size: 1.2rem; background: #f4f4f4; padding: 12px; border-radius: 6px; letter-spacing: 2px;">
                ${licenseKey}
              </div>
              <p>Enter this key in the WorkMate activation screen to get started.</p>
              <p style="color: #888; font-size: 0.875rem;">Keep this email safe — this is your proof of purchase.</p>
            </div>
          `,
        });

        if (error) {
          console.error("Resend error:", JSON.stringify(error));
        } else {
          console.log(`License email sent to: ${email}, id: ${data?.id}`);
        }
      } catch (err) {
        console.error("Error saving license or sending email:", (err as Error).message);
      }
    }

    res.status(200).send();
  }
);

export default router;