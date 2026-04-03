import "../server/env";

import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import path from "path";
import fs from "fs";
import { activateLicense } from "./routes/activate";
import { purchaseSerial } from "./routes/purchase";
import { activateLimiter } from "./middleware/rateLimit";
import { validateActivationInput } from "./middleware/validate";
import licenseRoutes from "./utils/license";

const app = express();
const FILES_DIR = path.resolve(__dirname, "../files");

app.use(helmet());
app.use(cors({ origin: "http://localhost:5173" }));

// ✅ licenseRoutes FIRST — before express.json() — so webhook gets raw body
app.use(licenseRoutes);

// ✅ express.json() AFTER — for all other routes
app.use(express.json());
app.use(morgan("combined"));

app.post("/activate", activateLimiter, validateActivationInput, activateLicense);
app.post("/purchase", purchaseSerial);

app.get("/api/download/:filename", (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.resolve(FILES_DIR, safeName);
  if (!filePath.startsWith(FILES_DIR) || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }
  res.download(filePath);
});

const PORT = Number(process.env.PORT) || 3000;
const server = app.listen(PORT, () => {
  console.log(`Workmate server running on port ${PORT}`);
});

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.log(`Port ${PORT} in use, trying ${PORT + 1}...`);
    server.listen(PORT + 1);
  }
});