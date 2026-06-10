import { NextResponse } from "next/server";
import { BOOTSTRAP_JSON_CACHE_HEADERS } from "@/lib/api-cache-headers";
import { fetchCatalogBootstrap } from "@/lib/catalog-bootstrap";
import { isR2PublicConfigured } from "@/lib/r2-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchCatalogBootstrap();

  return NextResponse.json(
    {
      products: result.products.ok ? result.products.products : [],
      productsError: result.products.ok ? null : result.products.error,
      site: result.storefront.site,
      collections: result.storefront.collections,
      journal: result.storefront.journal,
      boutiques: result.storefront.boutiques,
      storefrontUpdatedAt: result.storefront.updatedAt,
      storefrontSource: result.storefront.source,
      r2Ready: isR2PublicConfigured(),
    },
    { headers: BOOTSTRAP_JSON_CACHE_HEADERS },
  );
}
