import type { Product } from "./catalog";
import { slugify } from "./format";
import {
  cfResizedMediaUrl,
  type ProductImageDisplaySize,
} from "./media-image-url";
import { normalizeStaffMediaUrl } from "./staff-media-url";
import {
  flattenSizeOptions,
  normalizeSizeOptions,
  resolveProductSizes,
} from "./product-sizes";

/** Decode URL slug and compare case-insensitively (PDP + cards). */
export function normalizeSlugParam(slug: string): string {
  try {
    return decodeURIComponent(slug).trim().toLowerCase();
  } catch {
    return slug.trim().toLowerCase();
  }
}

export function findProductBySlug(products: Product[], slug: string | undefined): Product | undefined {
  if (!slug) return undefined;
  const norm = normalizeSlugParam(slug);
  return products.find((p) => normalizeSlugParam(p.slug) === norm);
}

/** Stable slug for Arabic-only names and legacy rows with empty slug. */
export function stableProductSlug(p: Pick<Product, "slug" | "name" | "id">): string {
  const trimmed = (p.slug ?? "").trim();
  if (trimmed) return trimmed;
  const fromName = slugify(p.name);
  if (fromName) return fromName;
  const idPart = p.id.replace(/^tmp-/, "").replace(/-/g, "").slice(0, 12);
  return `muhra-${idPart || "item"}`;
}

/** Placeholder when staff saves a product without images — keeps catalogue & PDP usable for ordering. */
export const MUHRA_PLACEHOLDER_IMAGE =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F6F1E7"/><stop offset="100%" stop-color="#E8E0D2"/></linearGradient></defs><rect fill="url(#g)" width="800" height="1000"/><ellipse cx="400" cy="410" rx="140" ry="160" fill="none" stroke="#B89A5E" stroke-width="1.5" opacity="0.4"/><text x="400" y="670" text-anchor="middle" font-family="Georgia,serif" font-size="20" letter-spacing="0.28em" fill="#B89A5E">MUHRA</text></svg>`,
  );

/** Collapse accidental `//` in the path; fix staff RTL / missing-protocol URLs. */
function normalizeCatalogImageUrl(src: string): string {
  const t = src.trim();
  if (!t || t.startsWith("data:")) return t;
  if (!t.startsWith("http://") && !t.startsWith("https://")) {
    return normalizeStaffMediaUrl(t);
  }
  try {
    const u = new URL(t);
    u.pathname = u.pathname.replace(/\/{2,}/g, "/");
    return u.href;
  } catch {
    return normalizeStaffMediaUrl(t);
  }
}

export function productImageAt(product: Product, index: number): string {
  const list = product.images?.filter((u) => u?.trim()) ?? [];
  if (list.length === 0) return MUHRA_PLACEHOLDER_IMAGE;
  const i = Math.max(0, Math.min(index, list.length - 1));
  const raw = list[i] ?? MUHRA_PLACEHOLDER_IMAGE;
  return raw.startsWith("data:") ? raw : normalizeCatalogImageUrl(raw);
}

/** Storefront display URL — CDN resize for R2 media; data: URLs unchanged. */
export function productImageForDisplay(
  src: string,
  size: ProductImageDisplaySize = "card",
): string {
  const raw = src.trim();
  if (!raw || raw.startsWith("data:")) return raw;
  const normalized = normalizeCatalogImageUrl(raw);
  return cfResizedMediaUrl(normalized, size);
}

export function productImageAtForDisplay(
  product: Product,
  index: number,
  size: ProductImageDisplaySize = "card",
): string {
  return productImageForDisplay(productImageAt(product, index), size);
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
function normalizeCatalogVideoUrl(src: string): string {
  const t = src.trim();
  if (!t || t.startsWith("data:")) return t;
  if (!t.startsWith("http://") && !t.startsWith("https://")) {
    return normalizeStaffMediaUrl(t);
  }
  try {
    const u = new URL(t);
    u.pathname = u.pathname.replace(/\/{2,}/g, "/");
    return u.href;
  } catch {
    return normalizeStaffMediaUrl(t);
  }
}

export function productVideoSources(product: Product): string[] {
  return (product.videos ?? []).map((u) => u.trim()).filter(Boolean).map(normalizeCatalogVideoUrl);
}

export function productHasVideos(product: Product): boolean {
  return productVideoSources(product).length > 0;
}

export function ensureProductOrderable(p: Product): Product {
  const slug = stableProductSlug(p);
  const imgs = (p.images ?? []).map((u) => u.trim()).filter(Boolean);
  const images = imgs.length > 0 ? imgs : [MUHRA_PLACEHOLDER_IMAGE];
  const vids = (p.videos ?? []).map((u) => u.trim()).filter(Boolean);
  const videos = vids.length > 0 ? vids : undefined;
  const sizeOptions = normalizeSizeOptions(p.sizeOptions);
  const resolved = resolveProductSizes({ ...p, sizeOptions });
  const sizes = resolved.length > 0 ? resolved : undefined;
  const flat = flattenSizeOptions(sizeOptions);
  return {
    ...p,
    slug,
    images,
    videos,
    sizeOptions,
    sizes: sizes ?? (flat.length > 0 ? flat : undefined),
  };
}

/**
 * Server Actions must stay small for Edge/Workers CPU limits. Inline data: images (base64) blow JSON size
 * and can trigger Cloudflare 1102 on save.
 */
const MAX_DATA_URL_CHARS_PER_IMAGE = 64 * 1024;
const MAX_TOTAL_DATA_URL_CHARS = 400 * 1024;

/** True when DB still holds inline base64 (not the small SVG placeholder). */
export function productHasEmbeddedImages(p: Product): boolean {
  return (p.images ?? []).some((u) => {
    const t = u.trim();
    return t.startsWith("data:") && t !== MUHRA_PLACEHOLDER_IMAGE;
  });
}

/**
 * Public catalog API: replace huge inline `data:` images with the small SVG placeholder.
 * Preserves image order and count so bag/checkout slug resolution stay stable.
 */
export function sanitizeProductForCatalogApi(p: Product): Product {
  const normalized = ensureProductOrderable(p);
  const images = (normalized.images ?? []).map((u) => {
    const t = u.trim();
    if (!t) return t;
    if (t.startsWith("data:")) return t === MUHRA_PLACEHOLDER_IMAGE ? t : MUHRA_PLACEHOLDER_IMAGE;
    return normalizeCatalogImageUrl(t);
  });
  const videos = (normalized.videos ?? [])
    .map((u) => u.trim())
    .filter((u) => u && !u.startsWith("data:"))
    .map(normalizeCatalogVideoUrl);
  return { ...normalized, images, videos: videos.length > 0 ? videos : undefined };
}

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
