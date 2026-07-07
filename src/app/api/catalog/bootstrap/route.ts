import { NextResponse } from "next/server";
import { fetchCatalogBootstrap } from "@/lib/catalog-bootstrap";
import { BOOTSTRAP_CORS_HEADERS } from "@/lib/catalog-cors";
import { isR2PublicConfigured } from "@/lib/r2-config";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: BOOTSTRAP_CORS_HEADERS });
}

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
    { headers: BOOTSTRAP_CORS_HEADERS },
  );
}
