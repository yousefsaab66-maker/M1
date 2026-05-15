import { NextResponse } from "next/server";
import { fetchCatalogProducts } from "@/lib/catalog-products-query";

export const dynamic = "force-dynamic";

/** Edge-cache catalog JSON to cut Worker CPU (1102); staff refresh still updates within ~60s. */
const CATALOG_JSON_CACHE = {
  "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
  "CDN-Cache-Control": "max-age=60",
} as const;

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
  return NextResponse.json({ products: result.products }, { headers: CATALOG_JSON_CACHE });
}
