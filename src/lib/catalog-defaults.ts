import type { Boutique, Collection, JournalArticle, Product, SiteContent } from "@/lib/catalog";

/** Lightweight fallbacks — avoids bundling full demo seed on every page load. */
export const EMPTY_PRODUCTS: Product[] = [];
export const EMPTY_COLLECTIONS: Collection[] = [];
export const EMPTY_JOURNAL: JournalArticle[] = [];
export const EMPTY_BOUTIQUES: Boutique[] = [];

export const DEFAULT_SITE: SiteContent = {
  brandName: "MUHRA JEWELRY",
  tagline: "",
  supportEmail: "",
  heroHeadline: "",
  heroSubhead: "",
};
