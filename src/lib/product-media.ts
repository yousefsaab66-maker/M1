import type { Product } from "./catalog";
import { slugify } from "./format";

/** Placeholder when staff saves a product without images — keeps catalogue & PDP usable for ordering. */
export const MUHRA_PLACEHOLDER_IMAGE =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F6F1E7"/><stop offset="100%" stop-color="#E8E0D2"/></linearGradient></defs><rect fill="url(#g)" width="800" height="1000"/><ellipse cx="400" cy="410" rx="140" ry="160" fill="none" stroke="#B89A5E" stroke-width="1.5" opacity="0.4"/><text x="400" y="670" text-anchor="middle" font-family="Georgia,serif" font-size="20" letter-spacing="0.28em" fill="#B89A5E">MUHRA</text></svg>`,
  );

/** Collapse accidental `//` in the path (common when joining base + key). Leaves `https://` intact. */
function normalizeCatalogImageUrl(src: string): string {
  const t = src.trim();
  if (!t.startsWith("http://") && !t.startsWith("https://")) return t;
  try {
    const u = new URL(t);
    u.pathname = u.pathname.replace(/\/{2,}/g, "/");
    return u.href;
  } catch {
    return t;
  }
}

export function productImageAt(product: Product, index: number): string {
  const list = product.images?.filter((u) => u?.trim()) ?? [];
  if (list.length === 0) return MUHRA_PLACEHOLDER_IMAGE;
  const i = Math.max(0, Math.min(index, list.length - 1));
  const raw = list[i] ?? MUHRA_PLACEHOLDER_IMAGE;
  return raw.startsWith("data:") ? raw : normalizeCatalogImageUrl(raw);
}

/** Gallery keys: real images or a single placeholder slot. */
export function productGallerySources(product: Product): string[] {
  const list = product.images?.filter((u) => u?.trim()) ?? [];
  if (list.length === 0) return [MUHRA_PLACEHOLDER_IMAGE];
  return list.map((u) => (u.startsWith("data:") ? u : normalizeCatalogImageUrl(u)));
}

/**
 * Ensures slug + images so the product resolves at `/products/[slug]` and can be added to bag / checkout.
 */
export function ensureProductOrderable(p: Product): Product {
  let slug = (p.slug ?? "").trim() || slugify(p.name);
  if (!slug) slug = `muhra-${Date.now()}`;
  const imgs = (p.images ?? []).map((u) => u.trim()).filter(Boolean);
  const images = imgs.length > 0 ? imgs : [MUHRA_PLACEHOLDER_IMAGE];
  const sizeList = [...new Set((p.sizes ?? []).map((s) => s.trim()).filter(Boolean))];
  const sizes = sizeList.length > 0 ? sizeList : undefined;
  return { ...p, slug, images, sizes };
}

/**
 * Server Actions must stay small for Edge/Workers CPU limits. Inline data: images (base64) blow JSON size
 * and can trigger Cloudflare 1102 on save.
 */
const MAX_DATA_URL_CHARS_PER_IMAGE = 64 * 1024;
const MAX_TOTAL_DATA_URL_CHARS = 400 * 1024;

/** Returns an error code if the payload is unsafe to send through a Worker to Supabase. */
export function validateProductPayloadForServerSave(p: Product): string | null {
  let total = 0;
  for (const u of p.images ?? []) {
    if (!u.startsWith("data:")) continue;
    if (u.length > MAX_DATA_URL_CHARS_PER_IMAGE) return "payload_image_too_large";
    total += u.length;
  }
  if (total > MAX_TOTAL_DATA_URL_CHARS) return "payload_images_too_large";
  return null;
}
