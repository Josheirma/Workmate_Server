import dotenv    from "dotenv"
const result = dotenv.config({ path: ".env.local" })

console.log("Server file loaded at:", new Date().toISOString())
import express   from "express"
import helmet    from "helmet"
import morgan    from "morgan"

import cors      from "cors"
import { activateLicense }         from "./routes/activate"
import { purchaseSerial }          from "./routes/purchase"
import { activateLimiter }         from "./middleware/rateLimit"
import { validateActivationInput } from "./middleware/validate"



console.log("DOTENV RESULT:", result)
console.log("DATABASE_URL:", process.env.DATABASE_URL)

const app = express()

app.use(helmet())
app.use(morgan("combined"))
app.use(express.json())
app.use(cors({
  origin: "http://localhost:5173",
}))

// routes
app.post("/activate", activateLimiter, validateActivationInput, activateLicense)
app.post("/purchase", purchaseSerial)

const PORT = Number(process.env.PORT) || 3000

const server = app.listen(PORT, () => {
  console.log(`Workmate server running on port ${PORT}`)
})

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.log(`Port ${PORT} in use, trying ${PORT + 1}...`)
    server.listen(PORT + 1)
  }
})