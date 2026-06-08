import type { MetadataRoute } from "next";
import { fetchSitemapSlugs } from "@/lib/seo-sitemap-data";
import { getSiteUrl } from "@/lib/site-url";

export const revalidate = 3600;

const STATIC_PATHS = [
  "/",
  "/products",
  "/collections",
  "/journal",
  "/boutiques",
  "/story",
  "/watches",
  "/bridal",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const { productSlugs, collectionSlugs, journalSlugs } = await fetchSitemapSlugs();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.8,
  }));

  const productEntries: MetadataRoute.Sitemap = productSlugs.map((slug) => ({
    url: `${base}/products/${encodeURIComponent(slug)}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const collectionEntries: MetadataRoute.Sitemap = collectionSlugs.map((slug) => ({
    url: `${base}/collections/${encodeURIComponent(slug)}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.75,
  }));

  const journalEntries: MetadataRoute.Sitemap = journalSlugs.map((slug) => ({
    url: `${base}/journal/${encodeURIComponent(slug)}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticEntries, ...collectionEntries, ...productEntries, ...journalEntries];
}
