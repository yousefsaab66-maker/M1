import { NextResponse } from "next/server";
import { BOOTSTRAP_JSON_CACHE_HEADERS } from "@/lib/api-cache-headers";
import { fetchCatalogBootstrap } from "@/lib/catalog-bootstrap";
import { isR2StaffUploadReady } from "@/lib/r2-staff-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchCatalogBootstrap();
  const r2Ready = await isR2StaffUploadReady();

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
      r2Ready,
    },
    { headers: BOOTSTRAP_JSON_CACHE_HEADERS },
  );
}
