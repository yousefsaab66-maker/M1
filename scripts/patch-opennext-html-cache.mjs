/**
 * OpenNext bakes s-maxage=31536000 on prerendered HTML (fixCacheHeaderForHtmlPages).
 * With run_worker_first:false, middleware never runs on asset HITs — patch build output
 * and ensure public/_headers is at the assets root for static HTML.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OPEN_NEXT = path.join(ROOT, ".open-next");

const HTML_CACHE_FROM = "public, max-age=0, s-maxage=31536000, must-revalidate";
const HTML_CACHE_TO =
  "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

const HTML_SMAXAGE_ONE_YEAR = "s-maxage=${CACHE_ONE_YEAR}";
const HTML_SMAXAGE_ONE_HOUR = "s-maxage=3600";

const REPLACEMENTS = [
  [HTML_CACHE_FROM, HTML_CACHE_TO],
  [
    "public,max-age=0,s-maxage=31536000,must-revalidate",
    "public,max-age=0,s-maxage=3600,stale-while-revalidate=86400",
  ],
  [HTML_SMAXAGE_ONE_YEAR, HTML_SMAXAGE_ONE_HOUR],
  ["let finalRevalidate = CACHE_ONE_YEAR", "let finalRevalidate = 3600"],
];

function walkFiles(dir, match, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkFiles(full, match, out);
    else if (match(full)) out.push(full);
  }
  return out;
}

function patchText(content) {
  let next = content;
  let changed = false;
  for (const [from, to] of REPLACEMENTS) {
    if (next.includes(from)) {
      next = next.replaceAll(from, to);
      changed = true;
    }
  }
  return { next, changed };
}

function patchCacheFile(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return false;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  const headers = parsed?.meta?.headers;
  if (!headers || typeof headers !== "object") return false;
  const key =
    "cache-control" in headers
      ? "cache-control"
      : "Cache-Control" in headers
        ? "Cache-Control"
        : null;
  if (!key) return false;
  const value = headers[key];
  if (typeof value !== "string" || !value.includes("31536000")) return false;
  headers[key] = HTML_CACHE_TO;
  fs.writeFileSync(file, JSON.stringify(parsed));
  return true;
}

if (!fs.existsSync(OPEN_NEXT)) {
  console.error(".open-next not found — run opennextjs-cloudflare build first");
  process.exit(1);
}

let patched = 0;

for (const file of walkFiles(OPEN_NEXT, (p) => /\.(js|mjs|cjs)$/.test(p))) {
  const raw = fs.readFileSync(file, "utf8");
  const { next, changed } = patchText(raw);
  if (changed) {
    fs.writeFileSync(file, next);
    patched += 1;
  }
}

for (const file of walkFiles(path.join(OPEN_NEXT, "cache"), (p) => p.endsWith(".cache"))) {
  if (patchCacheFile(file)) patched += 1;
}

const headersSrc = path.join(ROOT, "public", "_headers");
const headersDst = path.join(OPEN_NEXT, "assets", "_headers");
if (fs.existsSync(headersSrc)) {
  fs.mkdirSync(path.dirname(headersDst), { recursive: true });
  fs.copyFileSync(headersSrc, headersDst);
  console.log("Synced public/_headers → .open-next/assets/_headers");
}

console.log(`HTML cache patch: updated ${patched} file(s) to s-maxage=3600`);
