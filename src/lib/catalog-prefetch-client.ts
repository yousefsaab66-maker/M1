/** Warm catalog JSON on key storefront pages — respects save-data and runs once per tab. */
let prefetched = false;

export function prefetchCatalogProductsApi(): void {
  if (typeof window === "undefined" || prefetched) return;
  prefetched = true;

  const href = "/api/catalog/products?full=1";
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return;

  try {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = href;
    link.as = "fetch";
    document.head.appendChild(link);
  } catch {
    void fetch(href, { credentials: "same-origin", cache: "default" }).catch(() => {});
  }
}
