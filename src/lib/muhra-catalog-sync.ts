import { invalidateCatalogProductsCache } from "@/lib/catalog-products-query";
import { writeStorefrontToR2 } from "@/lib/storefront-r2";

/** After staff product save/delete — refresh R2 embedded catalog and drop in-flight Supabase list caches. */
export async function syncCatalogAfterProductChange(): Promise<void> {
  invalidateCatalogProductsCache();
  try {
    await writeStorefrontToR2({});
  } catch {
    /* R2 optional — Supabase remains source of truth */
  }
}
