import type { Metadata } from "next";
import { COLLECTIONS } from "@/lib/catalog";
import { fetchStorefront } from "@/lib/storefront-query";
import { buildPageMetadata } from "@/lib/seo-metadata";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const storefront = await fetchStorefront();
  const collections =
    storefront.kind === "ok" && storefront.collections?.length
      ? storefront.collections
      : COLLECTIONS;
  const collection = collections.find((c) => c.slug === slug);

  if (collection) {
    return buildPageMetadata({
      title: `${collection.name} — MUHRA JEWELRY`,
      description: collection.description || collection.tagline,
      path: `/collections/${slug}`,
      image: collection.coverImage,
    });
  }

  return buildPageMetadata({
    title: "Collection — MUHRA JEWELRY",
    description: "Explore MUHRA JEWELRY collections.",
    path: `/collections/${slug}`,
  });
}

export default function CollectionSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
