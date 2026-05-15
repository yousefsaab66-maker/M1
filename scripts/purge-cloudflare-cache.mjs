/**
 * Purge Cloudflare edge cache for the zone (use after deploy if users still see old HTML).
 *
 * Requires in the environment (e.g. `.env.local` — not committed — or CI secrets):
 *   CLOUDFLARE_ZONE_ID   — Zone → Overview → Zone ID
 *   CLOUDFLARE_API_TOKEN — API token with Zone → Cache Purge → Purge (Edit)
 *
 * Usage:
 *   - Export `CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_API_TOKEN`, then `npm run cf:purge`
 *   - Or put them in `.env.local` and run `npm run cf:purge:local` (Node loads the file)
 */

const zoneId = process.env.CLOUDFLARE_ZONE_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;

if (!zoneId || !token) {
  console.error(
    "Missing CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN. Set them in the shell or load .env.local before running.",
  );
  process.exit(1);
}

const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`;
const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ purge_everything: true }),
});

const body = await res.json().catch(() => ({}));

if (!res.ok || body.success === false) {
  console.error("Cloudflare purge failed:", res.status, body);
  process.exit(1);
}

console.log("Cloudflare cache purge requested successfully.");
