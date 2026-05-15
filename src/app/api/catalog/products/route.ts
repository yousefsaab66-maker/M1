import { NextResponse } from "next/server";
import { fetchCatalogProducts } from "@/lib/catalog-products-query";

export const dynamic = "force-dynamic";

/** Prevent shared caches (CDN/proxy/browser) from serving stale catalog JSON. */
const NO_STORE_JSON = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
} as const;

export async function GET() {
  const result = await fetchCatalogProducts();
  if (result.kind === "not_configured") {
    return NextResponse.json({ error: "backend_not_configured" }, { status: 503, headers: NO_STORE_JSON });
  }
  if (result.kind === "error") {
    return NextResponse.json({ error: result.message }, { status: 500, headers: NO_STORE_JSON });
  }
  return NextResponse.json({ products: result.products }, { headers: NO_STORE_JSON });
}
