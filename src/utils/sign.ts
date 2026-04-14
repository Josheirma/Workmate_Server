import crypto from "crypto"
import fs from "fs"

// Read once at module load — not on every activation request.
// If the file is missing the server fails at startup, which is correct
// (fail fast rather than serving broken signatures).
const PRIVATE_KEY: string = (() => {
  const p = process.env.PRIVATE_KEY_PATH
  if (!p) throw new Error("PRIVATE_KEY_PATH is not set")
  return fs.readFileSync(p, "utf8")
})()

export function signLicense(serial: string, machineID: string): string {
  const payload = JSON.stringify({ serial, machineID })
  return crypto
    .sign("sha256", Buffer.from(payload), {
      key: PRIVATE_KEY,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    })
    .toString("base64")
}
