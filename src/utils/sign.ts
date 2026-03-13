import crypto from "crypto"
import fs from "fs"

export function signLicense(serial: string, machineID: string): string {
  const privateKey = fs.readFileSync(process.env.PRIVATE_KEY_PATH!, "utf8")
  const payload = JSON.stringify({ serial, machineID })

  const signature = crypto.sign(
    "sha256",
    Buffer.from(payload),
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING
    }
  )

  return signature.toString("base64")
}
