import type { Metadata } from "next";
import { JOURNAL } from "@/lib/catalog";
import { buildPageMetadata } from "@/lib/seo-metadata";
export { staticPageDynamic as dynamic } from "@/lib/static-page";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const article = JOURNAL.find((a) => a.slug === slug);

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
