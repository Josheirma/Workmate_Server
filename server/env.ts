import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

// Presence-only check — never log secret values, even truncated
if (process.env.NODE_ENV !== "production") {
  console.log("ENV (dev only):", {
    DB:     process.env.DATABASE_URL     ? "✓" : "✗ MISSING",
    PAYPAL: process.env.PAYPAL_SECRET    ? "✓" : "✗ MISSING",
    RESEND: process.env.RESEND_API_KEY   ? "✓" : "✗ MISSING",
    KEY:    process.env.PRIVATE_KEY_PATH ? "✓" : "✗ MISSING",
  })
}
