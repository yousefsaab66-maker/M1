/**
 * Storefront pages: pre-render at build so Cloudflare serves HTML from assets (avoids Error 1102).
 * Import in a page: `export { staticPageDynamic as dynamic } from "@/lib/static-page";`
 */
export const staticPageDynamic = "force-static" as const;
