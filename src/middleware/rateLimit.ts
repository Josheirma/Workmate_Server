import rateLimit from "express-rate-limit"

export const activateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // 10 attempts per IP
  message: { success: false, error: "too many attempts" }
})
