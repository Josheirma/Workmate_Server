import crypto from "crypto"
import pool   from "../db/pool"

// ─── core generator ───────────────────────────
function generateSerial(): string {
  const part = () => crypto.randomBytes(2).toString("hex").toUpperCase()
  return `WM-${part()}-${part()}-${part()}`
}

// ─── BOX: run before printing ─────────────────
export async function generateSerialBatch(count: number): Promise<string[]> {
  const serials: string[] = []

  for (let i = 0; i < count; i++) {
    const serial = generateSerial()
    console.log(`Generated box serial ${serial}`)
    await pool.query(
      `INSERT INTO serials (serial, type)
       VALUES ($1, 'box')`,
      [serial]
    )

    serials.push(serial)
  }

  return serials
}

// ─── ONLINE: run on purchase ───────────────────
export async function generateOnlineSerial(email: string): Promise<string> {
  const serial = generateSerial()

 const result = await pool.query(
  `INSERT INTO serials (serial, type, email)
   VALUES ($1, 'online', $2)
   RETURNING *`,
  [serial, email]
)
console.log("DB insert result:", result.rows[0])

  return serial
}