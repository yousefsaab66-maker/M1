import type { Product } from "@/lib/catalog";
import { rowToProduct, type ProductRow } from "@/lib/catalog-db";
import { sanitizeProductForCatalogApi } from "@/lib/product-media";
import { isSupabaseBackendConfigured, supabaseAdmin } from "@/lib/supabase/admin";

export type FetchCatalogProductsResult =
  | { kind: "ok"; products: Product[] }
  | { kind: "not_configured" }
  | { kind: "error"; message: string };

export type FetchCatalogProductsOptions = {
  /** Staff diagnostics only — public API must sanitize inline `data:` images. */
  rawImages?: boolean;
};

/** Shared by `/api/catalog/products` — keep heavy work out of the root RSC tree to avoid Worker 1102. */
export async function fetchCatalogProducts(
  options?: FetchCatalogProductsOptions,
): Promise<FetchCatalogProductsResult> {
  if (!isSupabaseBackendConfigured()) return { kind: "not_configured" };
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.from("products").select("*").order("created_at", { ascending: false });
    if (error) return { kind: "error", message: error.message };
    const rows = (data ?? []).map((r) => rowToProduct(r as ProductRow));
    const products = options?.rawImages ? rows : rows.map(sanitizeProductForCatalogApi);
    return { kind: "ok", products };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return { kind: "error", message: msg };
  }
}
