import {
  COLLECTIONS as SEED_COLLECTIONS,
  JOURNAL as SEED_JOURNAL,
  PRODUCTS as SEED_PRODUCTS,
} from "@/lib/catalog";
import { fetchCatalogProductsForList } from "@/lib/catalog-products-query";
import { fetchStorefront } from "@/lib/storefront-query";

export type SitemapSlugSets = {
  productSlugs: string[];
  collectionSlugs: string[];
  journalSlugs: string[];
};

/** Product, collection, and journal slugs for sitemap — API first, seed fallback. */
export async function fetchSitemapSlugs(): Promise<SitemapSlugSets> {
  const [productsResult, storefrontResult] = await Promise.all([
    fetchCatalogProductsForList(),
    fetchStorefront(),
  ]);

  const productSlugs =
    productsResult.kind === "ok"
      ? productsResult.products.map((p) => p.slug).filter(Boolean)
      : SEED_PRODUCTS.map((p) => p.slug);

  const collectionSlugs =
    storefrontResult.kind === "ok" && storefrontResult.collections?.length
      ? storefrontResult.collections.map((c) => c.slug).filter(Boolean)
      : SEED_COLLECTIONS.map((c) => c.slug);

  const journalSlugs =
    storefrontResult.kind === "ok" && storefrontResult.journal?.length
      ? storefrontResult.journal.map((a) => a.slug).filter(Boolean)
      : SEED_JOURNAL.map((a) => a.slug);

  return { productSlugs, collectionSlugs, journalSlugs };
}
