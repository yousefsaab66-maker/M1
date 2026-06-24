import { supabaseAdmin } from "@/lib/supabase/admin";

export type StockAdjustResult =
  | { ok: true; newStock: number | null; skipped: boolean }
  | { ok: false; reason: "not_found" | "insufficient" | "rpc_error" };

/** Atomic decrement via Postgres RPC (`decrement_product_stock`). Skips unlimited (null) stock. */
export async function decrementProductStock(
  productId: string,
  qty: number,
): Promise<StockAdjustResult> {
  if (qty <= 0) return { ok: false, reason: "insufficient" };
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("decrement_product_stock", {
    p_product_id: productId,
    p_qty: qty,
  });
  if (error) return { ok: false, reason: "rpc_error" };
  const code = Number(data);
  if (code === -3) return { ok: true, newStock: null, skipped: true };
  if (code === -2) return { ok: false, reason: "not_found" };
  if (code === -1) return { ok: false, reason: "insufficient" };
  if (!Number.isFinite(code) || code < 0) return { ok: false, reason: "rpc_error" };
  return { ok: true, newStock: code, skipped: false };
}

/** Atomic increment via Postgres RPC (`increment_product_stock`). Skips unlimited (null) stock. */
export async function incrementProductStock(
  productId: string,
  qty: number,
): Promise<StockAdjustResult> {
  if (qty <= 0) return { ok: false, reason: "insufficient" };
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("increment_product_stock", {
    p_product_id: productId,
    p_qty: qty,
  });
  if (error) return { ok: false, reason: "rpc_error" };
  const code = Number(data);
  if (code === -3) return { ok: true, newStock: null, skipped: true };
  if (code === -2) return { ok: false, reason: "not_found" };
  if (code === -1) return { ok: false, reason: "insufficient" };
  if (!Number.isFinite(code) || code < 0) return { ok: false, reason: "rpc_error" };
  return { ok: true, newStock: code, skipped: false };
}

export async function decrementStocksForOrder(
  qtyByProduct: Map<string, number>,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const decremented: { productId: string; qty: number }[] = [];

  for (const [productId, qty] of qtyByProduct) {
    const result = await decrementProductStock(productId, qty);
    if (!result.ok) {
      for (const prev of decremented) {
        await incrementProductStock(prev.productId, prev.qty);
      }
      return {
        ok: false,
        reason: result.reason === "insufficient" ? "stock_insufficient" : "stock_adjust_failed",
      };
    }
    if (!result.skipped) decremented.push({ productId, qty });
  }

  return { ok: true };
}

export async function restoreStocksForOrder(
  items: { productId: string; qty: number }[],
): Promise<void> {
  const qtyByProduct = new Map<string, number>();
  for (const item of items) {
    qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.qty);
  }
  for (const [productId, qty] of qtyByProduct) {
    await incrementProductStock(productId, qty);
  }
}
