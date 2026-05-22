import type { Collection, SiteContent } from "@/lib/catalog";
import { fetchCatalogProductsForList } from "@/lib/catalog-products-query";
import { readStorefrontFromR2 } from "@/lib/storefront-r2";

export type CatalogBootstrapResult = {
  products: { ok: true; products: import("@/lib/catalog").Product[] } | { ok: false; error?: string };
  storefront: {
    site: SiteContent | null;
    collections: Collection[] | null;
    updatedAt: string | null;
    source: "r2" | "none";
  };
};

/** One Worker invocation — products + storefront in parallel (fewer 1102s than two browser round-trips). */
export async function fetchCatalogBootstrap(): Promise<CatalogBootstrapResult> {
  const [productsResult, storefrontR2] = await Promise.all([
    fetchCatalogProductsForList(),
    readStorefrontFromR2(),
  ]);

  const products =
    productsResult.kind === "ok"
      ? { ok: true as const, products: productsResult.products }
      : {
          ok: false as const,
          error: productsResult.kind === "error" ? productsResult.message : "not_configured",
        };

  if (storefrontR2.ok && storefrontR2.data) {
    return {
      products,
      storefront: {
        site: storefrontR2.data.site,
        collections: storefrontR2.data.collections,
        updatedAt: storefrontR2.data.updatedAt,
        source: "r2",
      },
    };
  }

  return {
    products,
    storefront: { site: null, collections: null, updatedAt: null, source: "none" },
  };
}
