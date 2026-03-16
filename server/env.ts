import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

console.log("ENV LOADED:", {
  STRIPE: process.env.STRIPE_SECRET_KEY?.slice(0, 10),
  DB: process.env.DATABASE_URL?.slice(0, 20),
});