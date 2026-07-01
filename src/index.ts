import "../server/env"
//
import express from "express"
import helmet from "helmet"
import morgan from "morgan"
import cors from "cors"
import { activateLicense } from "./routes/activate"
import { activateLimiter, paypalLimiter } from "./middleware/rateLimit"
import { validateActivationInput } from "./middleware/validate"
import paypalRoutes from "./routes/paypal"
import { startEmailRetryWorker } from "./workers/emailRetry"

const app = express()

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "https://www.paypal.com", "https://www.sandbox.paypal.com"],
      frameSrc:    ["https://www.paypal.com", "https://www.sandbox.paypal.com"],
      connectSrc:  ["'self'", "https://www.paypal.com", "https://www.sandbox.paypal.com"],
      imgSrc:      ["'self'", "data:", "https:"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
    },
  },
}))

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "http://localhost:5173" }))

// ─── Body cap + logging ───────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }))
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"))

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use(paypalLimiter, paypalRoutes)
app.post("/activate", activateLimiter, validateActivationInput, activateLicense)

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT   = Number(process.env.PORT) || 3000
const server = app.listen(PORT, () => {
  console.log(`Workmate server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`)
  startEmailRetryWorker()
})

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") server.listen(PORT + 1)
})
