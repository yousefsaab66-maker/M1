import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Strong anti-stale for HTML + RSC + API navigations on Cloudflare (edge may otherwise
 * reuse responses briefly). Hashed assets stay excluded via `matcher`.
 *
 * `CDN-Cache-Control` is honored by Cloudflare’s edge in addition to `Cache-Control`.
 */
export function middleware(_request: NextRequest) {
  const res = NextResponse.next();
  res.headers.set(
    "Cache-Control",
    "private, no-cache, no-store, max-age=0, must-revalidate",
  );
  res.headers.set("CDN-Cache-Control", "no-store");
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|ttf|eot|json|webmanifest)$).*)",
  ],
};
