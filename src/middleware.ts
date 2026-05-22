import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const NO_STORE = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
} as const;

const CANONICAL_HOST = (process.env.MUHRA_CANONICAL_HOST ?? "www.muhrajewelry.com").toLowerCase();
const APEX_HOST = "muhrajewelry.com";

function applyApiCacheHeaders(request: NextRequest, res: NextResponse): NextResponse {
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

/**
 * - Apex → www (single canonical host; avoids split cookies / intermittent www Worker timeouts).
 * - Staff API routes: no-store (catalog JSON cache is set on `/api/catalog/products` response).
 */
export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") ?? request.nextUrl.host).split(":")[0]?.toLowerCase() ?? "";

  if (host === APEX_HOST && CANONICAL_HOST !== APEX_HOST) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = CANONICAL_HOST;
    return NextResponse.redirect(url, 308);
  }

  return applyApiCacheHeaders(request, NextResponse.next());
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)",
  ],
};
