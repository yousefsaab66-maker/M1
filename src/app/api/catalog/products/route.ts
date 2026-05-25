import { NextRequest, NextResponse } from "next/server";
import { CATALOG_JSON_CACHE_HEADERS, NO_STORE_JSON_HEADERS } from "@/lib/api-cache-headers";
import {
  fetchCatalogProductBySlug,
  fetchCatalogProducts,
  fetchCatalogProductsForList,
} from "@/lib/catalog-products-query";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    return await handleCatalogProductsGet(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500, headers: NO_STORE_JSON_HEADERS });
  }
}

async function handleCatalogProductsGet(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")?.trim();
  if (slug) {
    const one = await fetchCatalogProductBySlug(slug);
    if (one.kind === "not_configured") {
      return NextResponse.json({ error: "backend_not_configured" }, { status: 503, headers: NO_STORE_JSON_HEADERS });
    }
    if (one.kind === "error") {
      return NextResponse.json({ error: one.message }, { status: 500, headers: NO_STORE_JSON_HEADERS });
    }
    if (one.kind === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE_JSON_HEADERS });
    }
    return NextResponse.json({ product: one.product }, { headers: CATALOG_JSON_CACHE_HEADERS });
  }

  const full = req.nextUrl.searchParams.get("full") === "1";
  const result = full ? await fetchCatalogProducts() : await fetchCatalogProductsForList();
  if (result.kind === "not_configured") {
    return NextResponse.json({ error: "backend_not_configured" }, { status: 503, headers: NO_STORE_JSON_HEADERS });
  }
  if (result.kind === "error") {
    return NextResponse.json({ error: result.message }, { status: 500, headers: NO_STORE_JSON_HEADERS });
  }
  return NextResponse.json({ products: result.products }, { headers: CATALOG_JSON_CACHE_HEADERS });
}
