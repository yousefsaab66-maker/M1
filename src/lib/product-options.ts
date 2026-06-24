import type { Product } from "@/lib/catalog";

export const PRODUCT_OPTION_SLOT_COUNT = 9;

export type ProductOptionSlot = {
  /** Staff toggle — only enabled slots with a label appear on the storefront. */
  enabled: boolean;
  /** Variant / description label shown to shoppers. */
  label?: string;
};

export type ProductOptions = ProductOptionSlot[];

export function emptyProductOptions(): ProductOptions {
  return Array.from({ length: PRODUCT_OPTION_SLOT_COUNT }, () => ({
    enabled: false,
  }));
}

function normalizeSlot(raw: Partial<ProductOptionSlot> | undefined): ProductOptionSlot {
  return {
    enabled: !!raw?.enabled,
    label: raw?.label?.trim() || undefined,
  };
}

export function productOptionsFromRow(
  raw: ProductOptions | null | undefined,
): ProductOptions | undefined {
  if (!raw || !Array.isArray(raw)) return undefined;
  return normalizeProductOptions(raw.map(normalizeSlot));
}

export function normalizeProductOptions(
  opts: ProductOptions | undefined,
): ProductOptions | undefined {
  if (!opts?.length) return undefined;
  const slots = opts.slice(0, PRODUCT_OPTION_SLOT_COUNT).map(normalizeSlot);
  const hasActive = slots.some((s) => s.enabled && !!s.label);
  return hasActive ? slots : undefined;
}

/** Persistable product options — drops rows with no enabled label. */
export function coalesceProductOptionsForSave(
  opts: ProductOptions | undefined,
): ProductOptions | undefined {
  return normalizeProductOptions(opts);
}

export type ActiveProductOptionSlot = {
  index: number;
  label: string;
};

export function getActiveProductOptionSlots(
  product: Pick<Product, "productOptions">,
): ActiveProductOptionSlot[] {
  const opts = product.productOptions;
  if (!opts?.length) return [];
  return opts
    .map((slot, index) => ({ index, ...normalizeSlot(slot) }))
    .filter((slot) => slot.enabled && !!slot.label)
    .map(({ index, label }) => ({ index, label: label! }));
}

export function requiresProductOptionSelection(
  product: Pick<Product, "productOptions">,
): boolean {
  return getActiveProductOptionSlots(product).length > 1;
}

export function resolveProductOptionLabel(
  product: Pick<Product, "productOptions">,
  productOptionSlotIndex?: number,
): string | undefined {
  const active = getActiveProductOptionSlots(product);
  if (productOptionSlotIndex != null) {
    const slot = active.find((s) => s.index === productOptionSlotIndex);
    if (slot) return slot.label;
  }
  if (active.length === 1) return active[0]!.label;
  return undefined;
}

export function productOptionSlotLabel(
  slot: ActiveProductOptionSlot,
  t: (key: string) => string,
): string {
  if (slot.label) return slot.label;
  return t("product.productOption").replace("{n}", String(slot.index + 1));
}
