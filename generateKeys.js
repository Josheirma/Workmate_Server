const crypto = require("crypto")
const fs     = require("fs")

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding:  { type: "spki",  format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" }
})

fs.writeFileSync("private.pem", privateKey)
fs.writeFileSync("public.pem",  publicKey)

console.log("Keys generated: private.pem and public.pem")
console.log("NEVER commit private.pem — embed public.pem in your Electron app")
