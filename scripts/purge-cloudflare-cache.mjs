/**
 * Targeted Cloudflare edge cache purge (use after deploy — never purge_everything).
 *
 * Requires in the environment (e.g. `.env.local` — not committed — or CI secrets):
 *   CLOUDFLARE_ZONE_ID   — Zone → Overview → Zone ID
 *   CLOUDFLARE_API_TOKEN — API token with Zone → Cache Purge → Purge (Edit)
 *   NEXT_PUBLIC_SITE_URL — optional, defaults to https://www.muhrajewelry.com
 *   NEXT_PUBLIC_R2_PUBLIC_BASE_URL — optional, e.g. https://media.muhrajewelry.com
 *
 * Usage:
 *   - Export vars, then `npm run cf:purge`
 *   - Or put them in `.env.local` and run `npm run cf:purge:local`
 */

const zoneId = process.env.CLOUDFLARE_ZONE_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;

if (!zoneId || !token) {
  console.error(
    "Missing CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN. Set them in the shell or load .env.local before running.",
  );
  process.exit(1);
}

const siteBase = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.muhrajewelry.com").replace(
  /\/$/,
  "",
);
const r2Base = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim()?.replace(/\/$/, "");

const files = [
  `${siteBase}/api/catalog/products`,
  `${siteBase}/api/catalog/products?full=1`,
  `${siteBase}/api/catalog/bootstrap`,
  `${siteBase}/api/catalog/storefront`,
  `${siteBase}/api/staff/bootstrap`,
];
if (r2Base) files.push(`${r2Base}/site/storefront.json`);

const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`;
const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ files }),
});

const body = await res.json().catch(() => ({}));

if (!res.ok || body.success === false) {
  console.error("Cloudflare purge failed:", res.status, body);
  process.exit(1);
}

console.log("Cloudflare targeted cache purge requested successfully.");
console.log("Purged URLs:", files.length);
