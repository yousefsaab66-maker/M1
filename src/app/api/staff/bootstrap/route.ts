import { NextResponse } from "next/server";
import { NO_STORE_JSON_HEADERS } from "@/lib/api-cache-headers";
import { fetchCatalogProductsForList } from "@/lib/catalog-products-query";
import { isR2PublicConfigured } from "@/lib/r2-config";
import { readStorefrontFromR2 } from "@/lib/storefront-r2";

export const dynamic = "force-dynamic";

/**
 * Staff init — list products + site/collections only (no journal/boutiques bodies).
 * Sequential R2/Supabase work to stay under Cloudflare Worker CPU limits (1102).
 */
export async function GET() {
  const productsResult = await fetchCatalogProductsForList();
  const storefrontR2 = await readStorefrontFromR2();

  const products =
    productsResult.kind === "ok" ? productsResult.products : [];
  const productsError =
    productsResult.kind === "ok"
      ? null
      : productsResult.kind === "error"
        ? productsResult.message
        : "not_configured";

  if (storefrontR2.ok && storefrontR2.data) {
    return NextResponse.json(
      {
        products,
        productsError,
        site: storefrontR2.data.site,
        collections: storefrontR2.data.collections,
        storefrontUpdatedAt: storefrontR2.data.updatedAt,
        storefrontSource: "r2" as const,
        r2Ready: isR2PublicConfigured(),
      },
      { headers: NO_STORE_JSON_HEADERS },
    );
  }

  return NextResponse.json(
    {
      products,
      productsError,
      site: null,
      collections: null,
      storefrontUpdatedAt: null,
      storefrontSource: "none" as const,
      r2Ready: isR2PublicConfigured(),
    },
    { headers: NO_STORE_JSON_HEADERS },
  );
}
