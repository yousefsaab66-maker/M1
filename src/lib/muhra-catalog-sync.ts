import { invalidateCatalogProductsCache } from "@/lib/catalog-products-query";
import { purgeCloudflareCatalogCache } from "@/lib/cloudflare-purge";

/**
 * After staff product save/delete — invalidate Worker list cache and purge catalog CDN URLs.
 * Supabase-only (no R2 catalog embed refresh) to avoid CF 1102 on delete.
 */
export function syncCatalogAfterProductChange(): void {
  invalidateCatalogProductsCache();
  void purgeCloudflareCatalogCache().catch(() => {});
}
