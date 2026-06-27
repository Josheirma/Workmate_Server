import "../server/env"

import express from "express"
import helmet from "helmet"
import morgan from "morgan"
import cors from "cors"
import path from "path"
import fs from "fs"
import crypto from "crypto"
import { activateLicense } from "./routes/activate"
import { activateLimiter, paypalLimiter } from "./middleware/rateLimit"
import { validateActivationInput } from "./middleware/validate"
import paypalRoutes from "./routes/paypal"
import pool from "./db/pool"
import { startEmailRetryWorker } from "./workers/emailRetry"

const app = express()
const FILES_DIR = path.resolve(__dirname, "../files")

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

// ─── CORS — env-driven, not hardcoded ────────────────────────────────────────
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "http://localhost:5173" }))

// ─── Body cap + logging ───────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }))
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"))

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use(paypalLimiter, paypalRoutes)
app.post("/activate", activateLimiter, validateActivationInput, activateLicense)

// ─── Download — serial-gated, single-use token ───────────────────────────────
//
// Two endpoints:
//   POST /api/download-token { serial }
//     → verifies serial is activated → inserts a signed single-use token → returns it
//   GET  /api/download/:filename?token=<token>
//     → verifies HMAC + expiry → marks token used=true atomically → serves file

const DOWNLOAD_SECRET = process.env.DOWNLOAD_TOKEN_SECRET || "change-me-in-env"
const TOKEN_TTL_MS    = 15 * 60 * 1000

function makeToken(serial: string): string {
  const payload = Buffer.from(
    JSON.stringify({ serial, exp: Date.now() + TOKEN_TTL_MS, nonce: crypto.randomBytes(8).toString("hex") })
  ).toString("base64url")
  const sig = crypto.createHmac("sha256", DOWNLOAD_SECRET).update(payload).digest("base64url")
  return `${payload}.${sig}`
}

function verifyToken(token: string): { serial: string } | null {
  const [payload, sig] = token.split(".")
  if (!payload || !sig) return null
  const expected = crypto.createHmac("sha256", DOWNLOAD_SECRET).update(payload).digest("base64url")
  if (sig.length !== expected.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString())
    if (Date.now() > data.exp) return null
    return data
  } catch { return null }
}

app.post("/api/download-token", activateLimiter, async (req, res) => {
  const { serial } = req.body
  if (!serial || !/^WM-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(serial))
    return res.status(400).json({ error: "invalid serial" })

  try {
    const { rows } = await pool.query(`SELECT used FROM serials WHERE serial=$1`, [serial])
    if (!rows[0]?.used) return res.status(403).json({ error: "serial not activated" })

    const token     = makeToken(serial)
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)
    await pool.query(
      `INSERT INTO download_tokens (token, serial, used, expires_at) VALUES ($1,$2,false,$3)`,
      [token, serial, expiresAt]
    )
    return res.json({ token })
  } catch (err) {
    console.error("[download-token]", err)
    return res.status(500).json({ error: "internal error" })
  }
})

app.get("/api/download/:filename", async (req, res) => {
  const token = req.query.token as string | undefined
  if (!token) return res.status(401).json({ error: "token required" })

  if (!verifyToken(token)) return res.status(403).json({ error: "invalid or expired token" })

  try {
    // Atomic single-use check — UPDATE WHERE used=false; rowCount=0 means already used
    const result = await pool.query(
      `UPDATE download_tokens SET used=true WHERE token=$1 AND used=false AND expires_at>NOW()`,
      [token]
    )
    if (result.rowCount === 0) return res.status(403).json({ error: "token already used or expired" })
  } catch (err) {
    console.error("[download-consume]", err)
    return res.status(500).json({ error: "internal error" })
  }

  const safeName = path.basename(req.params.filename)
  const filePath = path.resolve(FILES_DIR, safeName)
  if (!filePath.startsWith(FILES_DIR) || !fs.existsSync(filePath))
    return res.status(404).json({ error: "file not found" })

  res.download(filePath)
})

// ─── Scheduled cleanup ────────────────────────────────────────────────────────
// Fallback if pg_cron unavailable. Runs every 24 h in-process.
// See migration 001 for the pg_cron version.
function scheduleCleanup() {
  const run = async () => {
    try {
      await Promise.all([
        pool.query(`DELETE FROM activation_logs  WHERE attempted_at < NOW() - INTERVAL '90 days'`),
        pool.query(`DELETE FROM idempotency_keys WHERE created_at   < NOW() - INTERVAL '24 hours'`),
        pool.query(`DELETE FROM download_tokens  WHERE expires_at   < NOW()`),
      ])
    } catch (err) {
      console.error("[cleanup]", err)
    }
  }
  run()
  setInterval(run, 24 * 60 * 60 * 1000)Befgore
}

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT   = Number(process.env.PORT) || 3000
const server = app.listen(PORT, () => {
  console.log(`Workmate server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`)
  scheduleCleanup()
  startEmailRetryWorker()
})

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") server.listen(PORT + 1)
})
