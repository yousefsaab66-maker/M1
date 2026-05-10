import { NextResponse } from "next/server";
import { rowToProduct, type ProductRow } from "@/lib/catalog-db";
import { isSupabaseBackendConfigured, supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Prevent shared caches (CDN/proxy/browser) from serving stale catalog JSON. */
const NO_STORE_JSON = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
} as const;

export async function GET() {
  if (!isSupabaseBackendConfigured()) {
    return NextResponse.json({ error: "backend_not_configured" }, { status: 503, headers: NO_STORE_JSON });
  }
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.from("products").select("*").order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE_JSON });
    return NextResponse.json(
      { products: (data ?? []).map((r) => rowToProduct(r as ProductRow)) },
      { headers: NO_STORE_JSON },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500, headers: NO_STORE_JSON });
  }
}
