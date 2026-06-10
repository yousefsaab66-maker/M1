import { isDatabaseProductId } from "@/lib/catalog-db";
import { syncCatalogAfterProductChange } from "@/lib/muhra-catalog-sync";
import { isSupabaseBackendConfigured, supabaseAdmin } from "@/lib/supabase/admin";

/** Shared Supabase delete for staff products (API route or Server Action). */
export async function deleteProductFromSupabase(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseBackendConfigured()) return { ok: false, error: "not_configured" };
  if (!isDatabaseProductId(id)) return { ok: false, error: "invalid_id" };
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("products").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "not_found" };
  syncCatalogAfterProductChange();
  return { ok: true };
}
