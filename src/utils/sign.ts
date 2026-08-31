// Node's built-in cryptography module.
//
// We use crypto.sign() below to create a digital signature for the
// license payload. The signature proves that the server created the
// license and that the payload has not been modified.
import crypto from "crypto"

// Node's built-in filesystem module.
//
// We use this to read the private RSA key from a file on the server.
import fs from "fs"


// ================================================================
// LOAD THE PRIVATE KEY
// ================================================================
//
// We load the private key ONCE when this module is loaded.
//
// This is intentional.
//
// We do NOT want to read the private-key file every time a license
// is activated because:
//
//   1. Reading the file repeatedly is unnecessary disk I/O.
//   2. The private key does not change for every request.
//   3. Loading it once makes signing faster.
//   4. If the key is missing, we want the server to fail immediately.
//
// In other words:
//
//     Server starts
//          ↓
//     Read PRIVATE_KEY_PATH
//          ↓
//     Read private-key file
//          ↓
//     Store private key in PRIVATE_KEY
//          ↓
//     Server can now sign licenses
//
// If anything goes wrong here, the server will fail during startup
// instead of starting successfully and then producing broken
// licenses later.
//
// This is called "fail fast."
// ================================================================

const PRIVATE_KEY: string = (() => {

  // Get the path to the private-key file from an environment
  // variable.
  //
  // Example:
  //
  // PRIVATE_KEY_PATH=/secrets/license-private.pem
  //
  // The actual path should come from the server's environment,
  // rather than being hard-coded into the source code.
  const p = process.env.PRIVATE_KEY_PATH


  // Make sure the environment variable actually exists.
  //
  // If it doesn't exist, we cannot sign licenses because we don't
  // know where the private key is.
  //
  // Throwing an error here causes the server startup to fail.
  if (!p) {
    throw new Error("PRIVATE_KEY_PATH is not set")
  }


  // Read the private-key file from disk.
  //
  // "utf8" tells Node to return the file as a normal string instead
  // of returning a Buffer.
  //
  // The result might look conceptually like:
  //
  // -----BEGIN PRIVATE KEY-----
  // ...
  // -----END PRIVATE KEY-----
  //
  // We store that entire string in PRIVATE_KEY.
  return fs.readFileSync(p, "utf8")

})()


// ================================================================
// SIGN A LICENSE
// ================================================================
//
// This function creates a digital signature for a particular:
//
//     serial number
//     +
//     machine ID
//
// The caller gives us:
//
//     serial   -> identifies the license
//     machineID -> identifies the computer the license is tied to
//
// The function returns:
//
//     a Base64-encoded digital signature
//
// The private key is used to CREATE the signature.
//
// Later, the corresponding PUBLIC key can be used to VERIFY
// the signature.
//
// Important:
//
// The private key should remain on the server.
//
// The public key can be distributed with the application if
// necessary because it cannot be used to create valid signatures.
// ================================================================

export function signLicense(
  serial: string,
  machineID: string
): string {

  // --------------------------------------------------------------
  // STEP 1: Create the data that we want to sign.
  // --------------------------------------------------------------
  //
  // We create one JavaScript object containing the two pieces of
  // information that make up this license:
  //
  //     serial
  //     machineID
  //
  // Example:
  //
  // {
  //   serial: "ABC-123",
  //   machineID: "computer-456"
  // }
  //
  // We then convert that object into JSON.
  //
  // The important idea is that we are NOT signing the signature.
  //
  // We are signing the actual license information.
  //
  // Later, verification can recreate this exact payload and check
  // whether the signature matches it.
  const payload = JSON.stringify({
    serial,
    machineID
  })


  // --------------------------------------------------------------
  // STEP 2: Create the digital signature.
  // --------------------------------------------------------------
  //
  // crypto.sign() takes:
  //
  //     1. The hashing algorithm
  //     2. The data to sign
  //     3. The private-key configuration
  //
  // Here we use SHA-256 as the hash algorithm.
  //
  // Conceptually:
  //
  //     payload
  //        ↓
  //     SHA-256 hash
  //        ↓
  //     RSA private-key signing
  //        ↓
  //     digital signature
  //
  // The signature is generated using PRIVATE_KEY.
  //
  // This means somebody who does not possess the private key
  // should not be able to create a valid signature for a
  // different serial/machineID combination.
  const signature = crypto.sign(
    "sha256",

    // crypto.sign() expects the data as a Buffer.
    //
    // Buffer.from(payload) converts the JSON string into bytes.
    Buffer.from(payload),

    {
      // Tell Node which private key should be used to sign the
      // data.
      key: PRIVATE_KEY,

      // Use RSA-PSS padding.
      //
      // RSA-PSS is a modern RSA signature padding scheme designed
      // to provide strong security properties for RSA signatures.
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    }
  )


  // --------------------------------------------------------------
  // STEP 3: Convert the signature into a string.
  // --------------------------------------------------------------
  //
  // crypto.sign() returns a Buffer containing binary signature
  // data.
  //
  // Binary data isn't convenient to put into JSON, send through
  // an API, or store in a database.
  //
  // Therefore we convert it to Base64.
  //
  // Example:
  //
  //     binary signature
  //            ↓
  //     Base64 string
  //            ↓
  //     "k3J9...abc="
  //
  // The Base64 string represents the same signature.
  return signature.toString("base64")
}