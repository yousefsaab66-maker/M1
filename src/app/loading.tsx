import { CatalogLoadingSkeleton } from "@/components/layout/CatalogLoadingSkeleton";

/**
 * Shown during route transitions while the next segment resolves (App Router).
 * Uses `CatalogLoadingSkeleton` (embedded variant — real Header/Footer stay from the layout).
 */
export default function Loading() {
  return <CatalogLoadingSkeleton variant="embedded" />;
}
