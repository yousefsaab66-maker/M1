/**
 * Edge catalog JSON — short TTL so public catalog stays fresh without per-save R2 sync.
 * After staff product save/delete: client calls `/api/staff/purge-cache?scope=catalog` (targeted, async).
 * After deploy: `npm run cf:purge`; storefront edits purge via PUT `/api/staff/storefront`.
 */
export const CATALOG_JSON_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=90, stale-while-revalidate=300",
  "CDN-Cache-Control": "max-age=90",
} as const;

/** Site + collections from `/api/catalog/storefront` (same TTL as products). */
export const STOREFRONT_JSON_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=1800",
  "CDN-Cache-Control": "max-age=600",
} as const;

/** Staff panel init — short edge cache to absorb reload bursts (auth not required). */
export const STAFF_BOOTSTRAP_JSON_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=120, stale-while-revalidate=600",
  "CDN-Cache-Control": "max-age=120",
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

/**
 * Pre-rendered HTML shells (storefront + /staff/*) — edge cache so reloads skip Worker CPU (CF 1102).
 * Purge zone cache after deploy: `npm run cf:purge`.
 */
export const HTML_PAGE_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  "CDN-Cache-Control": "max-age=3600",
} as const;
