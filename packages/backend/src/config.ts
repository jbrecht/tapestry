import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
}

export const JWT_SECRET = requireEnv("JWT_SECRET");
export const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:4200";
export const PORT = process.env.PORT || 3000;
