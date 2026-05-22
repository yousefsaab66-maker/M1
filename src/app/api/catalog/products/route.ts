import { NextResponse } from "next/server";
import { CATALOG_JSON_CACHE_HEADERS, NO_STORE_JSON_HEADERS } from "@/lib/api-cache-headers";
import { fetchCatalogProducts } from "@/lib/catalog-products-query";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchCatalogProducts();
  if (result.kind === "not_configured") {
    return NextResponse.json({ error: "backend_not_configured" }, { status: 503, headers: NO_STORE_JSON_HEADERS });
  }
  if (result.kind === "error") {
    return NextResponse.json({ error: result.message }, { status: 500, headers: NO_STORE_JSON_HEADERS });
  }
  return NextResponse.json({ products: result.products }, { headers: CATALOG_JSON_CACHE_HEADERS });
}
