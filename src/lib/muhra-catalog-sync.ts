import { invalidateCatalogProductsCache } from "@/lib/catalog-products-query";
import { purgeCloudflareCatalogCache } from "@/lib/cloudflare-purge";
import { refreshStorefrontCatalogInR2 } from "@/lib/storefront-r2";

/**
 * After staff product save/delete — invalidate Worker list cache, refresh R2 catalog embed,
 * and purge catalog CDN URLs. Background work is fire-and-forget to keep POST/DELETE fast (CF 1102).
 */
export function syncCatalogAfterProductChange(): void {
  invalidateCatalogProductsCache();
  /* Purge CDN first — public `/api/catalog/products` reads Supabase; R2 patch can follow. */
  void purgeCloudflareCatalogCache().catch(() => {});
  void refreshStorefrontCatalogInR2().catch(() => {});
}
