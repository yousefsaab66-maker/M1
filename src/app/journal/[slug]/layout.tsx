import type { Metadata } from "next";
import { JOURNAL } from "@/lib/catalog";
import { fetchStorefront } from "@/lib/storefront-query";
import { buildPageMetadata } from "@/lib/seo-metadata";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const storefront = await fetchStorefront();
  const journal =
    storefront.kind === "ok" && storefront.journal?.length ? storefront.journal : JOURNAL;
  const article = journal.find((a) => a.slug === slug);

  if (article) {
    return buildPageMetadata({
      title: `${article.title} — Le Journal — MUHRA JEWELRY`,
      description: article.excerpt,
      path: `/journal/${slug}`,
      image: article.image,
    });
  }

  return buildPageMetadata({
    title: "Le Journal — MUHRA JEWELRY",
    description: "Letters from the MUHRA JEWELRY Maison.",
    path: `/journal/${slug}`,
  });
}

export default function JournalSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
