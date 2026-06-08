/** Production canonical origin — never localhost in metadata / sitemap. */
const PRODUCTION_SITE_URL = "https://www.muhrajewelry.com";

/** Default Open Graph image (Maison hero jewellery). */
export const DEFAULT_OG_IMAGE =
  "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1200&h=630&q=80";

/** Resolve public site origin for metadata, sitemap, and JSON-LD. */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    try {
      return new URL(fromEnv.endsWith("/") ? fromEnv : `${fromEnv}/`).origin;
    } catch {
      /* fall through */
    }
  }

  const raw =
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  if (raw) {
    try {
      return new URL(raw.endsWith("/") ? raw : `${raw}/`).origin;
    } catch {
      /* fall through */
    }
  }

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_SITE_URL;
  }

  return "http://localhost:3000";
}

export function getMetadataBase(): URL {
  return new URL(`${getSiteUrl()}/`);
}

/** Absolute canonical URL for a storefront path (leading slash). */
export function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, getMetadataBase()).href;
}
