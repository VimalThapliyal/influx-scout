import { config } from "dotenv";
import { resolve } from "path";

let loaded = false;

export function loadEnv() {
  if (loaded) return;
  config({ path: resolve(process.cwd(), ".env.local") });
  config({ path: resolve(process.cwd(), ".env") });
  loaded = true;
}

export function requireEnv(name: string): string {
  loadEnv();
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env.local`);
  }
  return value;
}
