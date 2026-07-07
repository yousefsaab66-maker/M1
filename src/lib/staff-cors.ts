import { NO_STORE_JSON_HEADERS } from "@/lib/api-cache-headers";

export const STAFF_CORS_HEADERS = {
  ...NO_STORE_JSON_HEADERS,
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
};
