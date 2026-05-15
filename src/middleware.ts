import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const NO_STORE = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
} as const;

/**
 * Only non-cacheable staff/auth API routes get no-store. Catalog JSON is cacheable at the edge
 * (see `/api/catalog/products` Cache-Control) to reduce Worker invocations (Error 1102).
 */
export function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const path = request.nextUrl.pathname;
  const isPublicCatalog =
    path === "/api/catalog/products" ||
    path === "/api/catalog/storefront" ||
    path === "/api/health/r2";
  if (!isPublicCatalog) {
    res.headers.set("Cache-Control", NO_STORE["Cache-Control"]);
    res.headers.set("CDN-Cache-Control", NO_STORE["CDN-Cache-Control"]);
  }
  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
