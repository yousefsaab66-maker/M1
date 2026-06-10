import type { Metadata } from "next";
import { PRODUCTS } from "@/lib/catalog";
import { buildPageMetadata } from "@/lib/seo-metadata";
export { staticPageDynamic as dynamic } from "@/lib/static-page";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const fallback = PRODUCTS.find((p) => p.slug === slug);
  if (fallback) {
    return buildPageMetadata({
      title: `${fallback.name} — MUHRA JEWELRY`,
      description: fallback.description,
      path: `/products/${slug}`,
      image: fallback.images[0],
    });
  }

  return buildPageMetadata({
    title: "Product — MUHRA JEWELRY",
    description: "Discover fine jewellery from MUHRA JEWELRY.",
    path: `/products/${slug}`,
  });
}

export default function ProductSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
