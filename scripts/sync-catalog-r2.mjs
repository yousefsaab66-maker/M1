/**
 * Manual R2 catalog sync — patches `site/storefront.json` catalogProducts from Supabase.
 *
 * Requires:
 *   STAFF_COOKIE_SECRET — same as Worker secret
 *   NEXT_PUBLIC_SITE_URL — optional, defaults to https://www.muhrajewelry.com
 *   STAFF_USERNAME — optional, defaults to "staff"
 *
 * Usage:
 *   node --env-file=.env.local scripts/sync-catalog-r2.mjs
 *   npm run sync-catalog-r2
 */

import { createHmac } from "node:crypto";

const STAFF_COOKIE_NAME = "muhra_staff";

function signStaffSession(username, secret) {
  const exp = Date.now() + 7 * 864e5;
  const payload = Buffer.from(JSON.stringify({ u: username, exp }), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

const secret = process.env.STAFF_COOKIE_SECRET?.trim();
const username = process.env.STAFF_USERNAME?.trim() || "staff";
const siteBase = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.muhrajewelry.com").replace(
  /\/$/,
  "",
);

if (!secret || secret.length < 16) {
  console.error("Missing STAFF_COOKIE_SECRET (min 16 chars). Load via --env-file=.env.local");
  process.exit(1);
}

const token = signStaffSession(username, secret);
const url = `${siteBase}/api/staff/sync-catalog-r2`;

const res = await fetch(url, {
  method: "POST",
  headers: { Cookie: `${STAFF_COOKIE_NAME}=${token}` },
});

const body = await res.json().catch(() => ({}));

if (!res.ok || body.ok === false) {
  console.error("Catalog R2 sync failed:", res.status, body);
  process.exit(1);
}

console.log("Catalog R2 sync OK — catalogUpdatedAt:", body.catalogUpdatedAt ?? "(unknown)");
