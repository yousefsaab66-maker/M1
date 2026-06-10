import type { Product } from "@/lib/catalog";
import { productToInsert, rowToProduct, isDatabaseProductId, type ProductRow } from "@/lib/catalog-db";
import { ensureProductOrderable, validateProductPayloadForServerSave } from "@/lib/product-media";
import { isSupabaseBackendConfigured, supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Shared Supabase write for staff products (called from API route or Server Action).
 * Lighter path for Cloudflare: prefer POST /api/staff/products over the Server Action bundle.
 */
export async function upsertProductToSupabase(
  p: Product,
): Promise<{ ok: true; product: Product } | { ok: false; error: string }> {
  if (!isSupabaseBackendConfigured()) return { ok: false, error: "not_configured" };

  const fixed = ensureProductOrderable(p);
  const payloadErr = validateProductPayloadForServerSave(fixed);
  if (payloadErr) return { ok: false, error: payloadErr };
  const row = productToInsert(fixed);
  const sb = supabaseAdmin();

  if (isDatabaseProductId(fixed.id)) {
    const { data, error } = await sb
      .from("products")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", fixed.id)
      .select("*")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "update_failed" };
    return { ok: true, product: rowToProduct(data as ProductRow) };
  }

  const { data, error } = await sb.from("products").insert(row).select("*").single();
  if (error || !data) return { ok: false, error: error?.message ?? "insert_failed" };
  return { ok: true, product: rowToProduct(data as ProductRow) };
}
