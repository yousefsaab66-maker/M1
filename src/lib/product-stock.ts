import type { BagItem } from "@/lib/commerce-types";
import type { Product } from "@/lib/catalog";
import { getActiveProductOptionSlots } from "@/lib/product-options";
import {
  getActivePriceSlots,
  normalizeProductStock,
  type ProductPriceOptions,
} from "@/lib/product-prices";
import type { ProductOptions } from "@/lib/product-options";
import { bagLineSizeKey } from "@/lib/product-sizes";

export type StockError = "out_of_stock" | "insufficient_stock";

export type StockCheckResult =
  | { ok: true }
  | { ok: false; error: StockError; available: number };

export type BagStockIssue = {
  productId: string;
  productName?: string;
  error: StockError;
  requested: number;
  available: number;
};

export type StockLineRef = {
  priceSlotIndex?: number;
  productOptionSlotIndex?: number;
};

export type StockAdjustLine = {
  productId: string;
  qty: number;
  priceSlotIndex?: number;
  productOptionSlotIndex?: number;
};

/** Slot-level stock when staff set a number; undefined = fall back to global. */
export function normalizeSlotStock(
  stock: number | null | undefined,
): number | undefined {
  if (stock == null) return undefined;
  const n = Math.floor(Number(stock));
  if (Number.isNaN(n)) return undefined;
  return Math.max(0, n);
}

function slotHasTrackedStock(
  opts: ProductPriceOptions | ProductOptions | undefined,
  index: number,
): boolean {
  const raw = opts?.[index]?.stock;
  return raw != null && !Number.isNaN(Number(raw));
}

function readSlotStock(
  opts: ProductPriceOptions | ProductOptions | undefined,
  index: number,
): number | undefined {
  if (!slotHasTrackedStock(opts, index)) return undefined;
  return normalizeSlotStock(opts![index]!.stock);
}

/** Collect every tracked inventory source (global + enabled slots with explicit stock). */
export function collectTrackedStockLevels(
  product: Pick<Product, "stock" | "priceOptions" | "productOptions">,
): number[] {
  const levels: number[] = [];
  const global = normalizeProductStock(product.stock);
  if (global != null) levels.push(global);

  const priceOpts = product.priceOptions;
  if (priceOpts?.length) {
    for (let i = 0; i < priceOpts.length; i++) {
      const slot = priceOpts[i];
      if (!slot?.enabled) continue;
      const s = readSlotStock(priceOpts, i);
      if (s != null) levels.push(s);
    }
  }

  const productOpts = product.productOptions;
  if (productOpts?.length) {
    for (let i = 0; i < productOpts.length; i++) {
      const slot = productOpts[i];
      if (!slot?.enabled) continue;
      const s = readSlotStock(productOpts, i);
      if (s != null) levels.push(s);
    }
  }

  return levels;
}

/** null/undefined = untracked (treated as in stock). */
export function isProductInStock(
  product: Pick<Product, "stock" | "priceOptions" | "productOptions">,
): boolean {
  const tracked = collectTrackedStockLevels(product);
  if (tracked.length === 0) return true;
  return tracked.some((n) => n > 0);
}

export function isStockTracked(
  product: Pick<Product, "stock" | "priceOptions" | "productOptions">,
): boolean {
  return collectTrackedStockLevels(product).length > 0;
}

/** Tracked stock at zero everywhere — sold out, not orderable. */
export function isProductSoldOut(
  product: Pick<Product, "stock" | "priceOptions" | "productOptions">,
): boolean {
  return !isProductInStock(product);
}

/** Some slots tracked and in stock, but not every active slot is available. */
export function hasPartialSlotAvailability(
  product: Pick<Product, "price" | "stock" | "priceOptions" | "productOptions">,
): boolean {
  if (isProductSoldOut(product)) return false;
  const activePrice = getActivePriceSlots(product);
  const activeOptions = getActiveProductOptionSlots(product);
  const activeSlots = [
    ...activePrice.map((s) => ({ kind: "price" as const, index: s.index })),
    ...activeOptions.map((s) => ({ kind: "option" as const, index: s.index })),
  ];
  if (activeSlots.length === 0) return false;

  let anyTracked = false;
  let anyAvailable = false;
  let anySoldOut = false;

  for (const slot of activeSlots) {
    const inStock = isSlotInStock(product, {
      priceSlotIndex: slot.kind === "price" ? slot.index : undefined,
      productOptionSlotIndex: slot.kind === "option" ? slot.index : undefined,
    });
    const tracked =
      slot.kind === "price"
        ? slotHasTrackedStock(product.priceOptions, slot.index) ||
          normalizeProductStock(product.stock) != null
        : slotHasTrackedStock(product.productOptions, slot.index) ||
          normalizeProductStock(product.stock) != null;
    if (tracked) anyTracked = true;
    if (inStock) anyAvailable = true;
    else anySoldOut = true;
  }

  return anyTracked && anyAvailable && anySoldOut;
}

/** Effective stock for a bag/order line. null = unlimited. */
export function resolveLineStock(
  product: Pick<Product, "stock" | "priceOptions" | "productOptions">,
  ref: StockLineRef,
): number | null {
  const slotStock = resolveExplicitSlotStock(product, ref);
  if (slotStock != null) return slotStock;
  return normalizeProductStock(product.stock) ?? null;
}

function resolveExplicitSlotStock(
  product: Pick<Product, "stock" | "priceOptions" | "productOptions">,
  ref: StockLineRef,
): number | null | undefined {
  const { priceSlotIndex, productOptionSlotIndex } = ref;
  if (priceSlotIndex != null) {
    const s = readSlotStock(product.priceOptions, priceSlotIndex);
    if (s != null) return s;
  }
  if (productOptionSlotIndex != null) {
    const s = readSlotStock(product.productOptions, productOptionSlotIndex);
    if (s != null) return s;
  }
  return undefined;
}

export function isSlotInStock(
  product: Pick<Product, "stock" | "priceOptions" | "productOptions">,
  ref: StockLineRef,
): boolean {
  const stock = resolveLineStock(product, ref);
  return stock == null || stock > 0;
}

export function resolveSlotStockDisplay(
  product: Pick<Product, "stock" | "priceOptions" | "productOptions">,
  ref: StockLineRef,
): number | null | undefined {
  const explicit = resolveExplicitSlotStock(product, ref);
  if (explicit != null) return explicit;
  const global = normalizeProductStock(product.stock);
  return global ?? undefined;
}

export function bagQtyForProduct(bag: BagItem[], productId: string): number {
  return bag
    .filter((b) => b.productId === productId)
    .reduce((sum, b) => sum + b.qty, 0);
}

export function bagQtyForStockLineExcluding(
  bag: BagItem[],
  productId: string,
  lineKey: string,
): number {
  return bag
    .filter((b) => b.productId === productId && bagLineSizeKey(b) !== lineKey)
    .reduce((sum, b) => sum + b.qty, 0);
}

/** @deprecated Use bagQtyForStockLineExcluding */
export function bagQtyForProductExcludingLine(
  bag: BagItem[],
  productId: string,
  excludeLineKey: string,
): number {
  return bagQtyForStockLineExcluding(bag, productId, excludeLineKey);
}

/** Max quantity for one bag line; null = unlimited. */
export function maxQtyForBagLine(
  product: Pick<Product, "id" | "stock" | "priceOptions" | "productOptions">,
  bag: BagItem[],
  lineKey: string,
  ref: StockLineRef,
): number | null {
  const stock = resolveLineStock(product, ref);
  if (stock == null) return null;
  const other = bagQtyForStockLineExcluding(bag, product.id, lineKey);
  return Math.max(0, stock - other);
}

export function validateAddQty(
  product: Pick<Product, "stock" | "priceOptions" | "productOptions">,
  bag: BagItem[],
  productId: string,
  addQty: number,
  lineKey: string,
  ref: StockLineRef,
): StockCheckResult {
  if (!isSlotInStock(product, ref)) {
    return { ok: false, error: "out_of_stock", available: 0 };
  }
  const stock = resolveLineStock(product, ref);
  if (stock == null) return { ok: true };

  const currentLineQty =
    bag.find((b) => b.productId === productId && bagLineSizeKey(b) === lineKey)?.qty ?? 0;
  const otherQty = bagQtyForStockLineExcluding(bag, productId, lineKey);
  const newTotal = otherQty + currentLineQty + addQty;

  if (newTotal > stock) {
    const available = Math.max(0, stock - otherQty - currentLineQty);
    return { ok: false, error: "insufficient_stock", available };
  }
  return { ok: true };
}

function stockLineKeyFromBagLine(line: BagItem): string {
  return `${line.productId}|${bagLineSizeKey(line)}`;
}

export function findBagStockIssues(bag: BagItem[], products: Product[]): BagStockIssue[] {
  const lookup = new Map(products.map((p) => [p.id, p]));
  const qtyByLine = new Map<string, number>();

  for (const line of bag) {
    const key = stockLineKeyFromBagLine(line);
    qtyByLine.set(key, (qtyByLine.get(key) ?? 0) + line.qty);
  }

  const issues: BagStockIssue[] = [];
  for (const [key, requested] of qtyByLine) {
    const productId = key.slice(0, key.indexOf("|"));
    const lineKey = key.slice(key.indexOf("|") + 1);
    const product = lookup.get(productId);
    if (!product) continue;

    const sample = bag.find(
      (b) => b.productId === productId && bagLineSizeKey(b) === lineKey,
    );
    const ref: StockLineRef = {
      priceSlotIndex: sample?.priceSlotIndex,
      productOptionSlotIndex: sample?.productOptionSlotIndex,
    };
    const stock = resolveLineStock(product, ref);
    if (stock == null) continue;

    if (stock === 0) {
      issues.push({
        productId,
        productName: product.name,
        error: "out_of_stock",
        requested,
        available: 0,
      });
    } else if (requested > stock) {
      issues.push({
        productId,
        productName: product.name,
        error: "insufficient_stock",
        requested,
        available: stock,
      });
    }
  }
  return issues;
}

export function validateBagStock(
  bag: BagItem[],
  products: Product[],
): { ok: true } | { ok: false; issues: BagStockIssue[] } {
  const issues = findBagStockIssues(bag, products);
  if (issues.length === 0) return { ok: true };
  return { ok: false, issues };
}

export function aggregateStockAdjustLines(bag: BagItem[]): StockAdjustLine[] {
  const map = new Map<string, StockAdjustLine>();
  for (const line of bag) {
    const key = stockLineKeyFromBagLine(line);
    const prev = map.get(key);
    if (prev) {
      prev.qty += line.qty;
    } else {
      map.set(key, {
        productId: line.productId,
        qty: line.qty,
        priceSlotIndex: line.priceSlotIndex,
        productOptionSlotIndex: line.productOptionSlotIndex,
      });
    }
  }
  return [...map.values()];
}

export function aggregateOrderStockLines(
  items: StockAdjustLine[],
): StockAdjustLine[] {
  const map = new Map<string, StockAdjustLine>();
  for (const item of items) {
    const key = `${item.productId}|p${item.priceSlotIndex ?? ""}|o${item.productOptionSlotIndex ?? ""}`;
    const prev = map.get(key);
    if (prev) prev.qty += item.qty;
    else map.set(key, { ...item });
  }
  return [...map.values()];
}
