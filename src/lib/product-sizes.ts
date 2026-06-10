import type { Product, SiteContent } from "@/lib/catalog";
import { customCategoryBySlug, isBuiltInCategory } from "@/lib/site-display";

export type ProductSizeKind = "necklace" | "bracelet" | "ring";

export type ProductSizeOptions = Partial<Record<ProductSizeKind, string[]>>;

const SIZE_KINDS: ProductSizeKind[] = ["necklace", "bracelet", "ring"];

/** Common MUHRA presets — staff can apply or edit per product. */
export const SIZE_PRESETS: Record<ProductSizeKind, string[]> = {
  necklace: ["40", "42", "45"],
  bracelet: ["15", "16", "17", "18", "19"],
  ring: ["48", "50", "52", "54"],
};

export function isSizeKindEnabled(
  opts: ProductSizeOptions | undefined,
  kind: ProductSizeKind,
): boolean {
  return opts != null && Object.prototype.hasOwnProperty.call(opts, kind);
}

function dedupeSizes(list: string[] | undefined): string[] | undefined {
  if (!list) return undefined;
  const out = [...new Set(list.map((s) => s.trim()).filter(Boolean))];
  return out.length > 0 ? out : undefined;
}

export function normalizeSizeOptions(opts: ProductSizeOptions | undefined): ProductSizeOptions | undefined {
  if (!opts) return undefined;
  const out: ProductSizeOptions = {};
  for (const kind of SIZE_KINDS) {
    const list = dedupeSizes(opts[kind]);
    if (list) out[kind] = list;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Maps product category slug to which size group the storefront should show. */
export function productSizeKindForCategory(
  category: string,
  site?: SiteContent,
): ProductSizeKind | null {
  if (category === "necklaces") return "necklace";
  if (category === "bracelets") return "bracelet";
  if (category === "rings" || category === "bridal") return "ring";
  if (site) {
    const custom = customCategoryBySlug(site, category);
    const parent = custom?.parentCategory;
    if (parent === "necklaces") return "necklace";
    if (parent === "bracelets") return "bracelet";
    if (parent === "rings" || parent === "bridal") return "ring";
  }
  return null;
}

/** Sizes shown on PDP / bag for this product (category-aware). */
export function resolveProductSizes(product: Product, site?: SiteContent): string[] {
  const kind = productSizeKindForCategory(product.category, site);
  const opts = normalizeSizeOptions(product.sizeOptions);
  if (opts && kind && opts[kind]?.length) return opts[kind]!;
  if (product.sizes?.length) {
    return [...new Set(product.sizes.map((s) => s.trim()).filter(Boolean))];
  }
  return [];
}

/** Flatten enabled size groups for staff table / legacy `sizes` column. */
export function flattenSizeOptions(opts: ProductSizeOptions | undefined): string[] {
  const normalized = normalizeSizeOptions(opts);
  if (!normalized) return [];
  const merged: string[] = [];
  for (const kind of SIZE_KINDS) {
    for (const s of normalized[kind] ?? []) merged.push(s);
  }
  return [...new Set(merged)];
}

/** Migrate legacy single `sizes` array into the matching group when saving old rows. */
export function legacySizesToOptions(
  sizes: string[] | undefined,
  category: string,
  site?: SiteContent,
): ProductSizeOptions | undefined {
  const list = dedupeSizes(sizes);
  if (!list) return undefined;
  const kind = productSizeKindForCategory(category, site);
  if (!kind) return undefined;
  return { [kind]: list };
}

export function formatSizeOptionsSummary(opts: ProductSizeOptions | undefined): string {
  const normalized = normalizeSizeOptions(opts);
  if (!normalized) return "";
  return SIZE_KINDS.filter((k) => normalized[k]?.length)
    .map((k) => (normalized[k] ?? []).join(", "))
    .join(" · ");
}

export function sizeOptionsFromRow(
  sizeOptions: ProductSizeOptions | null | undefined,
  legacySizes: string[] | null | undefined,
  category: string,
): ProductSizeOptions | undefined {
  const fromCol = normalizeSizeOptions(sizeOptions ?? undefined);
  if (fromCol) return fromCol;
  return legacySizesToOptions(legacySizes ?? undefined, category);
}
