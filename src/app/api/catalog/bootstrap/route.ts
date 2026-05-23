import { NextResponse } from "next/server";
import { fetchCatalogBootstrap } from "@/lib/catalog-bootstrap";
import { isR2StaffUploadReady } from "@/lib/r2-staff-context";

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
} as const;

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
    { headers: NO_STORE },
  );
}
