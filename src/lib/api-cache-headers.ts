/**
 * Edge catalog JSON — keep Worker CPU low (CF 1102).
 * After staff edits: `npm run cf:purge` (or `cf:purge:local`); PUT `/api/staff/storefront` also
 * triggers a soft zone purge when CLOUDFLARE_ZONE_ID + CLOUDFLARE_API_TOKEN are set.
 */
export const CATALOG_JSON_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
  "CDN-Cache-Control": "max-age=300",
} as const;

/** Site + collections from `/api/catalog/storefront` (same TTL as products). */
export const STOREFRONT_JSON_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
  "CDN-Cache-Control": "max-age=300",
} as const;

/**
 * Combined bootstrap — prefer CDN + `/api/catalog/products` on the client to avoid hitting this.
 * Short edge cache when bootstrap is still used (staff or fallback).
 */
export const BOOTSTRAP_JSON_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
  "CDN-Cache-Control": "max-age=60",
} as const;

export const NO_STORE_JSON_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
} as const;
