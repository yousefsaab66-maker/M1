import type { BagItem } from "@/lib/commerce-types";
import type { Product } from "@/lib/catalog";
import { isProductInStock } from "@/lib/product-prices";
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

export function bagQtyForProduct(bag: BagItem[], productId: string): number {
  return bag
    .filter((b) => b.productId === productId)
    .reduce((sum, b) => sum + b.qty, 0);
}

export function bagQtyForProductExcludingLine(
  bag: BagItem[],
  productId: string,
  excludeLineKey: string,
): number {
  return bag
    .filter((b) => b.productId === productId && bagLineSizeKey(b) !== excludeLineKey)
    .reduce((sum, b) => sum + b.qty, 0);
}

/** Max quantity for one bag line; null = unlimited. */
export function maxQtyForBagLine(
  product: Pick<Product, "id" | "stock">,
  bag: BagItem[],
  lineKey: string,
): number | null {
  if (product.stock == null) return null;
  const other = bagQtyForProductExcludingLine(bag, product.id, lineKey);
  return Math.max(0, product.stock - other);
}

export function validateAddQty(
  product: Pick<Product, "stock">,
  bag: BagItem[],
  productId: string,
  addQty: number,
  lineKey: string,
): StockCheckResult {
  if (!isProductInStock(product)) {
    return { ok: false, error: "out_of_stock", available: 0 };
  }
  if (product.stock == null) return { ok: true };

  const currentLineQty =
    bag.find((b) => b.productId === productId && bagLineSizeKey(b) === lineKey)?.qty ?? 0;
  const otherQty = bagQtyForProductExcludingLine(bag, productId, lineKey);
  const newTotal = otherQty + currentLineQty + addQty;

  if (newTotal > product.stock) {
    const available = Math.max(0, product.stock - otherQty - currentLineQty);
    return { ok: false, error: "insufficient_stock", available };
  }
  return { ok: true };
}

export function findBagStockIssues(bag: BagItem[], products: Product[]): BagStockIssue[] {
  const lookup = new Map(products.map((p) => [p.id, p]));
  const qtyByProduct = new Map<string, number>();

  for (const line of bag) {
    qtyByProduct.set(line.productId, (qtyByProduct.get(line.productId) ?? 0) + line.qty);
  }

  const issues: BagStockIssue[] = [];
  for (const [productId, requested] of qtyByProduct) {
    const product = lookup.get(productId);
    if (!product || product.stock == null) continue;
    if (product.stock === 0) {
      issues.push({
        productId,
        productName: product.name,
        error: "out_of_stock",
        requested,
        available: 0,
      });
    } else if (requested > product.stock) {
      issues.push({
        productId,
        productName: product.name,
        error: "insufficient_stock",
        requested,
        available: product.stock,
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
