/**
 * Storefront pages: pre-render at build so Cloudflare serves HTML from assets (avoids Error 1102).
 * Import in a page: `export { staticPageDynamic as dynamic } from "@/lib/static-page";`
 *
 * `revalidate` sets Next/OpenNext `s-maxage` on prerendered HTML (default is 1y → CDN 31536000).
 * Root layout re-exports this; `public/_headers` still applies to `_next/static` and asset hits.
 */
export const staticPageDynamic = "force-static" as const;

/** Edge TTL for prerendered HTML shells — matches `HTML_PAGE_CACHE_HEADERS` / `public/_headers`. */
export const staticPageRevalidate = 3600;
