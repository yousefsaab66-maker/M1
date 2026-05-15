import { CatalogLoadingSkeleton } from "@/components/layout/CatalogLoadingSkeleton";

/** Shown during refresh / route transitions — never an empty main. */
export default function Loading() {
  return <CatalogLoadingSkeleton variant="embedded" />;
}
