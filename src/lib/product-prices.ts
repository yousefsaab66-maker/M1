import type { Product } from "@/lib/catalog";

export const PRICE_SLOT_COUNT = 9;

export type ProductPriceSlot = {
  /** Staff toggle — only enabled slots with amount > 0 appear on the storefront. */
  enabled: boolean;
  amount: number;
  /** Optional label (variant name, image caption, etc.). */
  label?: string;
  /** Per-slot quantity; omitted/null = use global product stock. */
  stock?: number | null;
};

export type ProductPriceOptions = ProductPriceSlot[];

export function emptyPriceOptions(): ProductPriceOptions {
  return Array.from({ length: PRICE_SLOT_COUNT }, () => ({
    enabled: false,
    amount: 0,
  }));
}

function normalizeSlot(raw: Partial<ProductPriceSlot> | undefined): ProductPriceSlot {
  const stockRaw = raw?.stock;
  const stock =
    stockRaw != null && !Number.isNaN(Number(stockRaw))
      ? Math.max(0, Math.floor(Number(stockRaw)))
      : undefined;
  return {
    enabled: !!raw?.enabled,
    amount: Math.max(0, Number(raw?.amount) || 0),
    label: raw?.label?.trim() || undefined,
    ...(stock != null ? { stock } : {}),
  };
}

export function priceOptionsFromRow(
  raw: ProductPriceOptions | null | undefined,
): ProductPriceOptions | undefined {
  if (!raw || !Array.isArray(raw)) return undefined;
  return normalizePriceOptions(raw.map(normalizeSlot));
}

export function normalizePriceOptions(
  opts: ProductPriceOptions | undefined,
): ProductPriceOptions | undefined {
  if (!opts?.length) return undefined;
  const slots = opts.slice(0, PRICE_SLOT_COUNT).map(normalizeSlot);
  const hasActive = slots.some((s) => s.enabled && s.amount > 0);
  return hasActive ? slots : undefined;
}

/** Persistable price options — drops rows with no enabled amount. */
export function coalescePriceOptionsForSave(
  opts: ProductPriceOptions | undefined,
): ProductPriceOptions | undefined {
  return normalizePriceOptions(opts);
}

export type ActivePriceSlot = {
  index: number;
  amount: number;
  label?: string;
};

export function getActivePriceSlots(
  product: Pick<Product, "price" | "priceOptions">,
): ActivePriceSlot[] {
  const opts = product.priceOptions;
  if (!opts?.length) return [];
  return opts
    .map((slot, index) => ({ index, ...normalizeSlot(slot) }))
    .filter((slot) => slot.enabled && slot.amount > 0)
    .map(({ index, amount, label }) => ({ index, amount, label }));
}

export function resolveProductUnitPrice(
  product: Pick<Product, "price" | "priceOptions">,
  priceSlotIndex?: number,
): number {
  const active = getActivePriceSlots(product);
  if (priceSlotIndex != null) {
    const slot = active.find((s) => s.index === priceSlotIndex);
    if (slot) return slot.amount;
  }
  if (active.length === 1) return active[0]!.amount;
  if (active.length > 0) return Math.min(...active.map((s) => s.amount));
  return product.price;
}

export function getProductListingPrice(
  product: Pick<Product, "price" | "priceOptions">,
): number {
  const active = getActivePriceSlots(product);
  if (active.length > 0) return Math.min(...active.map((s) => s.amount));
  return product.price;
}

export function productHasMultiplePrices(
  product: Pick<Product, "price" | "priceOptions">,
): boolean {
  return getActivePriceSlots(product).length > 1;
}

export function requiresPriceSelection(
  product: Pick<Product, "price" | "priceOptions">,
): boolean {
  return getActivePriceSlots(product).length > 1;
}

export function normalizeProductStock(stock: number | null | undefined): number | null | undefined {
  if (stock == null) return null;
  const n = Math.floor(Number(stock));
  if (Number.isNaN(n)) return null;
  return Math.max(0, n);
}

export function priceSlotLabel(
  slot: ActivePriceSlot,
  t: (key: string) => string,
): string {
  if (slot.label) return slot.label;
  return t("product.priceOption").replace("{n}", String(slot.index + 1));
}
