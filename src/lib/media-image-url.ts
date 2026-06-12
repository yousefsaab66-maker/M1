import { getR2PublicBaseUrl } from "@/lib/r2-config";

const DEFAULT_MEDIA_ORIGIN = "https://media.muhrajewelry.com";

export type ProductImageDisplaySize = "thumb" | "card" | "pdp" | "zoom";

const DISPLAY_WIDTH: Record<ProductImageDisplaySize, number> = {
  thumb: 160,
  card: 640,
  pdp: 1200,
  zoom: 2000,
};

function mediaHosts(): Set<string> {
  const hosts = new Set<string>(["media.muhrajewelry.com", "www.muhrajewelry.com"]);
  const base = getR2PublicBaseUrl() || process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim();
  if (base) {
    try {
      hosts.add(new URL(base).hostname.toLowerCase());
    } catch {
      /* ignore */
    }
  }
  try {
    hosts.add(new URL(DEFAULT_MEDIA_ORIGIN).hostname.toLowerCase());
  } catch {
    /* ignore */
  }
  return hosts;
}

function isResizableMediaUrl(url: URL): boolean {
  if (url.pathname.includes("/cdn-cgi/image/")) return false;
  const host = url.hostname.toLowerCase();
  if (mediaHosts().has(host)) return true;
  return host.endsWith(".r2.dev");
}

/**
 * Cloudflare Image Resizing on the media CDN — smaller files for cards/thumbs/PDP
 * without routing through the Worker `/_next/image` optimizer.
 */
export function cfResizedMediaUrl(
  raw: string,
  size: ProductImageDisplaySize,
  opts?: { quality?: number },
): string {
  const src = raw.trim();
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) return src;

  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return src;
  if (!isResizableMediaUrl(url)) return src;

  const width = DISPLAY_WIDTH[size];
  const quality = opts?.quality ?? (size === "zoom" ? 90 : 85);
  const path = url.pathname.replace(/\/{2,}/g, "/");
  return `${url.origin}/cdn-cgi/image/width=${width},quality=${quality},format=auto${path}`;
}

export function isCfResizedMediaUrl(src: string): boolean {
  return typeof src === "string" && src.includes("/cdn-cgi/image/");
}
