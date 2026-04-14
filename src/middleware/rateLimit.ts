import rateLimit from "express-rate-limit"

// /activate + /api/download-token — 10 per IP per 15 min
export const activateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: "too many attempts" },
  standardHeaders: true,
  legacyHeaders: false,
})

// PayPal routes — 30 per IP per 15 min
// Prevents bots hammering create-order (inflates PayPal API costs) or
// spraying random orderIDs at capture-order.
export const paypalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
})
