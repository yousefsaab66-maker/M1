import { Suspense } from "react";
import { staticPageDynamic as dynamic } from "@/lib/static-page";
import { ProductsCatalog } from "./ProductsCatalog";

export { dynamic };

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="page-gutter py-20 md:py-28" />}>
      <ProductsCatalog />
    </Suspense>
  );
}
