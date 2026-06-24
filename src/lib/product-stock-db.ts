import { supabaseAdmin } from "@/lib/supabase/admin";
import type { StockAdjustLine } from "@/lib/product-stock";

export type StockAdjustResult =
  | { ok: true; newStock: number | null; skipped: boolean }
  | { ok: false; reason: "not_found" | "insufficient" | "rpc_error" };

/** Atomic decrement via Postgres RPC (`decrement_product_stock`). Skips unlimited (null) stock. */
export async function decrementProductStock(
  productId: string,
  qty: number,
  priceSlotIndex?: number,
  productOptionSlotIndex?: number,
): Promise<StockAdjustResult> {
  if (qty <= 0) return { ok: false, reason: "insufficient" };
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("decrement_product_stock", {
    p_product_id: productId,
    p_qty: qty,
    p_price_slot_index: priceSlotIndex ?? null,
    p_product_option_slot_index: productOptionSlotIndex ?? null,
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
  priceSlotIndex?: number,
  productOptionSlotIndex?: number,
): Promise<StockAdjustResult> {
  if (qty <= 0) return { ok: false, reason: "insufficient" };
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("increment_product_stock", {
    p_product_id: productId,
    p_qty: qty,
    p_price_slot_index: priceSlotIndex ?? null,
    p_product_option_slot_index: productOptionSlotIndex ?? null,
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
  lines: StockAdjustLine[],
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const decremented: StockAdjustLine[] = [];

  for (const line of lines) {
    const result = await decrementProductStock(
      line.productId,
      line.qty,
      line.priceSlotIndex,
      line.productOptionSlotIndex,
    );
    if (!result.ok) {
      for (const prev of decremented) {
        await incrementProductStock(
          prev.productId,
          prev.qty,
          prev.priceSlotIndex,
          prev.productOptionSlotIndex,
        );
      }
      return {
        ok: false,
        reason: result.reason === "insufficient" ? "stock_insufficient" : "stock_adjust_failed",
      };
    }
    if (!result.skipped) decremented.push(line);
  }

  return { ok: true };
}

export async function restoreStocksForOrder(lines: StockAdjustLine[]): Promise<void> {
  for (const line of lines) {
    await incrementProductStock(
      line.productId,
      line.qty,
      line.priceSlotIndex,
      line.productOptionSlotIndex,
    );
  }
}
