import type { Metadata } from "next";
import { COLLECTIONS } from "@/lib/catalog";
import { buildPageMetadata } from "@/lib/seo-metadata";
export { staticPageDynamic as dynamic } from "@/lib/static-page";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const collection = COLLECTIONS.find((c) => c.slug === slug);

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
