import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { HTML_PAGE_CACHE_HEADERS, NO_STORE_JSON_HEADERS } from "@/lib/api-cache-headers";

const CANONICAL_HOST = (process.env.MUHRA_CANONICAL_HOST ?? "www.muhrajewelry.com").toLowerCase();
const APEX_HOST = "muhrajewelry.com";

function isDocumentRequest(request: NextRequest): boolean {
  const dest = request.headers.get("sec-fetch-dest");
  if (dest === "document") return true;
  return (request.headers.get("accept") ?? "").includes("text/html");
}

const CACHEABLE_API_PATHS = new Set([
  "/api/catalog/products",
  "/api/catalog/storefront",
  "/api/health/r2",
  "/api/staff/bootstrap",
]);

function applyApiCacheHeaders(request: NextRequest, res: NextResponse): NextResponse {
  const path = request.nextUrl.pathname;
  if (!CACHEABLE_API_PATHS.has(path)) {
    res.headers.set("Cache-Control", NO_STORE_JSON_HEADERS["Cache-Control"]);
    res.headers.set("CDN-Cache-Control", NO_STORE_JSON_HEADERS["CDN-Cache-Control"]);
  }
  return res;
}

/** Override OpenNext default no-store on prerendered HTML so Cloudflare CDN absorbs reload bursts. */
function applyHtmlCacheHeaders(request: NextRequest, res: NextResponse): NextResponse {
  if (!isDocumentRequest(request)) return res;
  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/")) return res;
  res.headers.set("Cache-Control", HTML_PAGE_CACHE_HEADERS["Cache-Control"]);
  res.headers.set("CDN-Cache-Control", HTML_PAGE_CACHE_HEADERS["CDN-Cache-Control"]);
  return res;
}

/**
 * - Apex → www (single canonical host; avoids split cookies / intermittent www Worker timeouts).
 * - HTML: CDN-cacheable prerendered shells (Worker still runs on MISS; HIT avoids CF 1102).
 * - Staff API routes: no-store except `/api/staff/bootstrap` (route sets s-maxage=120).
 */
export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") ?? request.nextUrl.host).split(":")[0]?.toLowerCase() ?? "";

  if (host === APEX_HOST && CANONICAL_HOST !== APEX_HOST) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = CANONICAL_HOST;
    return NextResponse.redirect(url, 308);
  }

  const res = NextResponse.next();
  applyHtmlCacheHeaders(request, res);
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return applyApiCacheHeaders(request, res);
  }
  return res;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)",
  ],
};
