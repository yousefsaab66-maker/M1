import { invalidateCatalogProductsCache } from "@/lib/catalog-products-query";
import { purgeCloudflareCatalogCache } from "@/lib/cloudflare-purge";
import { refreshStorefrontCatalogInR2 } from "@/lib/storefront-r2";

/**
 * After staff product save/delete — invalidate Worker list cache, purge catalog CDN URLs,
 * and patch R2 `catalogProducts` async (lightweight — no full storefront rewrite).
 */
export function syncCatalogAfterProductChange(): void {
  invalidateCatalogProductsCache();
  void purgeCloudflareCatalogCache().catch(() => {});
  void refreshStorefrontCatalogInR2().catch(() => {});
}
