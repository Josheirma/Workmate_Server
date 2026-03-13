import dotenv from "dotenv"
dotenv.config()

import fs from "fs"
import path from "path"
import { generateSerialBatch } from "../src/utils/serial"

const count = parseInt(process.argv[2] || "100")

generateSerialBatch(count)
  .then(serials => {
    const filePath = path.join(__dirname, "..", "serials.txt")
    fs.writeFileSync(filePath, serials.join("\n"), "utf-8")
    console.log(`Generated ${serials.length} serials, saved to ${filePath}`)
        process.exit(0)
    })
    .catch(err => {
        console.error("Failed:", err)
        process.exit(1)
    })