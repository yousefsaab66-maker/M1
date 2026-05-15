import { NextResponse } from "next/server";
import { fetchCatalogBootstrap } from "@/lib/catalog-bootstrap";
import { getMuhraMediaR2Binding } from "@/lib/r2-upload";

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
} as const;

export async function GET() {
  const binding = await getMuhraMediaR2Binding();
  const r2Public = Boolean(process.env.R2_PUBLIC_BASE_URL?.trim());
  const result = await fetchCatalogBootstrap();

  return NextResponse.json(
    {
      products: result.products.ok ? result.products.products : [],
      productsError: result.products.ok ? null : result.products.error,
      site: result.storefront.site,
      collections: result.storefront.collections,
      storefrontUpdatedAt: result.storefront.updatedAt,
      storefrontSource: result.storefront.source,
      r2Ready: Boolean(binding && r2Public),
    },
    { headers: NO_STORE },
  );
}
