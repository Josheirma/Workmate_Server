import crypto from "crypto"
import pool from "../db/pool"

function generateSerial(): string {
  const part = () => crypto.randomBytes(2).toString("hex").toUpperCase()
  return `WM-${part()}-${part()}-${part()}`
}

// ─── BOX: run before printing ─────────────────
export async function generateSerialBatch(count: number): Promise<string[]> {
  const serials: string[] = []
  for (let i = 0; i < count; i++) {
    const serial = generateSerial()
    await pool.query(`INSERT INTO serials (serial, type) VALUES ($1, 'box')`, [serial])
    serials.push(serial)
  }
  console.log(`[serial] generated ${count} box serials`)
  return serials
}

// ─── ONLINE: run on purchase ───────────────────
// paypalOrderId stored in a UNIQUE column — DB enforces one serial per order.
export async function generateOnlineSerial(email: string, paypalOrderId?: string): Promise<string> {
  const serial = generateSerial()
  await pool.query(
    `INSERT INTO serials (serial, type, email, paypal_order_id) VALUES ($1, 'online', $2, $3)`,
    [serial, email, paypalOrderId ?? null]
  )
  // No sensitive values logged — orderID only for tracing
  console.log(`[serial] online serial created — orderID=${paypalOrderId ?? "none"}`)
  return serial
}
