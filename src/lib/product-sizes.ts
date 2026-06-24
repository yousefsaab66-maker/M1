import type { Product, SiteContent } from "@/lib/catalog";
import { customCategoryBySlug, isBuiltInCategory } from "@/lib/site-display";

export type ProductSizeKind = "necklace" | "bracelet" | "ring";

export type ProductSizeOptions = Partial<Record<ProductSizeKind, string[]>>;

export type ProductSizeSelections = Partial<Record<ProductSizeKind, string>>;

export type ProductSizeGroup = {
  kind: ProductSizeKind;
  sizes: string[];
};

const SIZE_KINDS: ProductSizeKind[] = ["necklace", "bracelet", "ring"];

/** Common MUHRA presets — staff can apply or edit per product. */
export const SIZE_PRESETS: Record<ProductSizeKind, string[]> = {
  necklace: ["40", "42", "45"],
  bracelet: ["15", "16", "17", "18", "19"],
  ring: ["5", "6", "7", "8", "9", "10", "11", "12", "13"],
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

/** Staff toggles ON but no values yet (draft UI state). */
export function enabledEmptySizeKinds(opts: ProductSizeOptions | undefined): ProductSizeKind[] {
  if (!opts) return [];
  return SIZE_KINDS.filter(
    (kind) => isSizeKindEnabled(opts, kind) && !dedupeSizes(opts[kind])?.length,
  );
}

/** Persistable size options — drops enabled-but-empty groups; sizes stay optional for all categories. */
export function coalesceSizeOptionsForSave(
  opts: ProductSizeOptions | undefined,
): ProductSizeOptions | undefined {
  return normalizeSizeOptions(opts);
}

/**
 * Save guard for staff payloads. Sizes are never required by category.
 * Enabled-but-empty groups are stripped on save — only block incoherent partial legacy data.
 */
export function validateSizeOptionsForSave(
  p: Pick<Product, "sizeOptions" | "sizes" | "category">,
  site?: SiteContent,
): string | null {
  const coalesced = coalesceSizeOptionsForSave(p.sizeOptions);
  if (coalesced) return null;

  const legacy = dedupeSizes(p.sizes);
  if (!legacy?.length) return null;

  const fromLegacy = legacySizesToOptions(p.sizes, p.category, site);
  if (fromLegacy) return null;

  // Legacy flat sizes that don't match the category kind — ignore on save, don't block.
  return null;
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

/** Enabled size groups for PDP — every toggled group, not just the product category. */
export function getProductSizeGroups(product: Product, site?: SiteContent): ProductSizeGroup[] {
  const opts = normalizeSizeOptions(product.sizeOptions);
  if (opts) {
    const groups: ProductSizeGroup[] = [];
    for (const kind of SIZE_KINDS) {
      const sizes = opts[kind];
      if (sizes?.length) groups.push({ kind, sizes });
    }
    if (groups.length > 0) return groups;
  }
  const legacy = product.sizes?.length
    ? [...new Set(product.sizes.map((s) => s.trim()).filter(Boolean))]
    : [];
  if (legacy.length === 0) return [];
  const kind = productSizeKindForCategory(product.category, site);
  if (kind) return [{ kind, sizes: legacy }];
  return [{ kind: "ring", sizes: legacy }];
}

/** Sizes shown on PDP / bag for this product (category-aware). */
export function resolveProductSizes(product: Product, site?: SiteContent): string[] {
  const groups = getProductSizeGroups(product, site);
  if (groups.length === 1) return groups[0]!.sizes;
  if (groups.length > 1) return flattenSizeOptions(product.sizeOptions);
  return [];
}

export function sizeKindLabelKey(kind: ProductSizeKind): `product.size.${ProductSizeKind}` {
  return `product.size.${kind}`;
}

/** Stable bag line key for single or multi-group size selections and price slot. */
export function bagLineSizeKey(item: {
  size?: string;
  sizeSelections?: ProductSizeSelections;
  priceSlotIndex?: number;
}): string {
  const sel = item.sizeSelections;
  let sizePart: string;
  if (sel && Object.keys(sel).length > 0) {
    sizePart = SIZE_KINDS.map((k) => `${k}=${sel[k] ?? ""}`).join("|");
  } else {
    sizePart = item.size ?? "";
  }
  const pricePart = item.priceSlotIndex != null ? `@p${item.priceSlotIndex}` : "";
  return sizePart + pricePart;
}

/** Persist multi-group selections in order `size` column (legacy plain values unchanged). */
export function serializeSizeForOrder(
  sizeSelections?: ProductSizeSelections,
  legacySize?: string,
): string | undefined {
  if (sizeSelections && Object.keys(sizeSelections).length > 0) {
    const parts = SIZE_KINDS.filter((k) => sizeSelections[k]).map(
      (k) => `${k}:${sizeSelections[k]}`,
    );
    if (parts.length > 0) return parts.join("|");
  }
  return legacySize?.trim() || undefined;
}

export function parseSerializedSize(size: string | undefined): ProductSizeSelections | null {
  if (!size?.includes(":")) return null;
  const out: ProductSizeSelections = {};
  for (const part of size.split("|")) {
    const idx = part.indexOf(":");
    if (idx <= 0) continue;
    const kind = part.slice(0, idx) as ProductSizeKind;
    const value = part.slice(idx + 1).trim();
    if (SIZE_KINDS.includes(kind) && value) out[kind] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function formatSizeSelectionsDisplay(
  sizeSelections: ProductSizeSelections | undefined,
  t: (key: string) => string,
  legacySize?: string,
): string | undefined {
  if (sizeSelections && Object.keys(sizeSelections).length > 0) {
    const parts = SIZE_KINDS.filter((k) => sizeSelections[k]).map(
      (k) => `${t(sizeKindLabelKey(k))}: ${sizeSelections[k]}`,
    );
    if (parts.length > 0) return parts.join(" · ");
  }
  if (legacySize) return `${t("common.size")}: ${legacySize}`;
  return undefined;
}

export function formatBagItemSizeDisplay(
  item: { size?: string; sizeSelections?: ProductSizeSelections },
  t: (key: string) => string,
): string | undefined {
  return formatSizeSelectionsDisplay(item.sizeSelections, t, item.size);
}

export function formatOrderSizeDisplay(size: string | undefined, t: (key: string) => string): string | undefined {
  const parsed = parseSerializedSize(size);
  if (parsed) return formatSizeSelectionsDisplay(parsed, t);
  return size ? `${t("common.size")}: ${size}` : undefined;
}

export function isSizeSelectionsComplete(
  groups: ProductSizeGroup[],
  selections: ProductSizeSelections,
): boolean {
  return groups.every((g) => Boolean(selections[g.kind]?.trim()));
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

function parseSizeNumbers(sizes: string[]): number[] {
  return sizes
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !Number.isNaN(n));
}

/** Heuristic — avoid migrating bracelet/necklace cm values into ring groups. */
function sizesPlausibleForKind(sizes: string[], kind: ProductSizeKind): boolean {
  const nums = parseSizeNumbers(sizes);
  if (nums.length === 0) return false;
  if (kind === "ring") return nums.every((n) => (n >= 4 && n <= 13) || (n >= 40 && n <= 70));
  if (kind === "necklace") return nums.every((n) => n >= 35 && n <= 90);
  if (kind === "bracelet") return nums.every((n) => n >= 12 && n <= 25);
  return true;
}

/** Migrate legacy single `sizes` array into the matching group when values fit that kind. */
export function legacySizesToOptions(
  sizes: string[] | undefined,
  category: string,
  site?: SiteContent,
): ProductSizeOptions | undefined {
  const list = dedupeSizes(sizes);
  if (!list) return undefined;
  const kind = productSizeKindForCategory(category, site);
  if (!kind || !sizesPlausibleForKind(list, kind)) return undefined;
  return { [kind]: list };
}

const SIZE_HAS_UNIT = /\d\s*(cm|mm|in|"|''|inch|inches)\b/i;

/** Display suffix for storefront size chips (mixed legacy units). */
export function formatSizeDisplayValue(kind: ProductSizeKind, size: string): string {
  const trimmed = size.trim();
  if (!trimmed) return trimmed;
  if (SIZE_HAS_UNIT.test(trimmed)) return trimmed;
  if (kind === "necklace" || kind === "bracelet") {
    if (/^\d+(\.\d+)?$/.test(trimmed)) return `${trimmed} cm`;
    if (/^\d+(\.\d+)?\s*cm$/i.test(trimmed)) return trimmed.replace(/\s*cm$/i, " cm");
  }
  if (kind === "ring") {
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const n = parseFloat(trimmed);
      if (n >= 4 && n <= 13) return `US ${trimmed}`;
      if (n >= 40 && n <= 70) return trimmed;
    }
  }
  return trimmed;
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
