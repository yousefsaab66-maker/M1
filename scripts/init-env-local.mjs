/**
 * Creates `.env.local` from `.env.example` if missing (never overwrites).
 * Run: npm run env:init
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const example = path.join(root, ".env.example");
const local = path.join(root, ".env.local");

if (!fs.existsSync(example)) {
  console.error("init-env-local: .env.example not found at", example);
  process.exit(1);
}

if (fs.existsSync(local)) {
  console.log("init-env-local: .env.local already exists — not overwriting.");
  console.log("  Edit .env.local with your keys, then restart: npm run dev");
  process.exit(0);
}

fs.copyFileSync(example, local);
console.log("init-env-local: created .env.local from .env.example");
console.log("  1) Open .env.local and replace YOUR_PROJECT_REF and secrets.");
console.log("  2) Set R2_PUBLIC_BASE_URL to the same origin as product image URLs (prod or http://127.0.0.1:PORT for local R2).");
console.log("  3) Run: npm run dev");
