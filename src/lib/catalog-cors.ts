import { BOOTSTRAP_JSON_CACHE_HEADERS, CATALOG_JSON_CACHE_HEADERS } from "@/lib/api-cache-headers";

/** CORS for mobile app catalog fetches (Expo native + web). */
export const CATALOG_CORS_HEADERS = {
  ...CATALOG_JSON_CACHE_HEADERS,
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

export const BOOTSTRAP_CORS_HEADERS = {
  ...BOOTSTRAP_JSON_CACHE_HEADERS,
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};
