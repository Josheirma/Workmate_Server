import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Without this, a dropped idle client emits an unhandled Node 'error' event
// that crashes the process (network blip, DB restart, etc.)
pool.on("error", (err) => {
  console.error("[pool] idle client error:", err.message)
})

export default pool
