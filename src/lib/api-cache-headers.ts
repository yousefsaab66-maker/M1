/** Edge catalog JSON — keep Worker CPU low (CF 1102). Purge with `npm run cf:purge` after staff catalog edits. */
export const CATALOG_JSON_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
  "CDN-Cache-Control": "max-age=60",
} as const;

export const NO_STORE_JSON_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
} as const;
