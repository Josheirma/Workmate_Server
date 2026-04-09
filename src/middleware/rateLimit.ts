import rateLimit from "express-rate-limit"

export const activateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // 10 attempts per IP
  message: { success: false, error: "too many attempts" }
})

export const purchaseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                     // stricter than activate — purchase hits email + DB
  message: { success: false, error: "too many attempts" }
});

