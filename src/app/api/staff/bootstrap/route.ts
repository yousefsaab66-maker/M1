import { NextResponse } from "next/server";
import { STAFF_BOOTSTRAP_JSON_CACHE_HEADERS } from "@/lib/api-cache-headers";
import { fetchCatalogProductsForList } from "@/lib/catalog-products-query";
import { isR2PublicConfigured } from "@/lib/r2-config";
import { readStorefrontFromR2 } from "@/lib/storefront-r2";

export const dynamic = "force-dynamic";

/**
 * Staff init — list products + site/collections only (no journal/boutiques bodies).
 * Products first; storefront R2 read is best-effort so an empty catalog still returns fast (1102).
 */
export async function GET() {
  const productsResult = await fetchCatalogProductsForList();

  const products =
    productsResult.kind === "ok" ? productsResult.products : [];
  const productsError =
    productsResult.kind === "ok"
      ? null
      : productsResult.kind === "error"
        ? productsResult.message
        : "not_configured";

  let storefrontR2: Awaited<ReturnType<typeof readStorefrontFromR2>>;
  try {
    storefrontR2 = await readStorefrontFromR2();
  } catch {
    storefrontR2 = { ok: false, error: "r2_read_failed" };
  }

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
      { headers: STAFF_BOOTSTRAP_JSON_CACHE_HEADERS },
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
    { headers: STAFF_BOOTSTRAP_JSON_CACHE_HEADERS },
  );
}
