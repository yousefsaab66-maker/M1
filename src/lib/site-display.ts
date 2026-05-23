import type { Category, Collection, Product, SiteContent } from "@/lib/catalog";
import { HERO_POSTER } from "@/lib/catalog";

/** Categories shown on the homepage strip (order fixed). */
export const HOME_CATEGORY_STRIP: Category[] = ["necklaces", "rings", "earrings", "bracelets"];

/** Dedicated landing pages with staff-managed hero (and optional second image). */
export const CATEGORY_LANDING_PAGES: Category[] = ["watches", "bridal"];

/** All filter categories in the products catalogue. */
export const CATALOG_CATEGORIES: Category[] = [
  "necklaces",
  "rings",
  "earrings",
  "bracelets",
  "watches",
  "bridal",
];

const DEFAULT_CATEGORY_IMAGES: Record<Category, string> = {
  necklaces:
    "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1200&q=80",
  rings:
    "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=1200&q=80",
  earrings:
    "https://images.unsplash.com/photo-1635767798638-3e25273a8236?auto=format&fit=crop&w=1200&q=80",
  bracelets:
    "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=1200&q=80",
  watches:
    "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=1200&q=80",
  bridal:
    "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=80",
};

export const DEFAULT_ATELIER_IMAGE =
  "https://images.unsplash.com/photo-1622398925373-3f91b1e275f5?auto=format&fit=crop&w=1600&q=80";

export function categoryLabel(
  category: Category,
  site: SiteContent,
  t: (key: string) => string,
): string {
  const custom = site.categories?.[category]?.label?.trim();
  return custom && custom.length > 0 ? custom : t(`category.${category}`);
}

export function categoryImage(category: Category, site: SiteContent): string {
  const custom = site.categories?.[category]?.image?.trim();
  return custom && custom.length > 0 ? custom : DEFAULT_CATEGORY_IMAGES[category];
}

const DEFAULT_BRIDAL_EDITORIAL =
  "https://images.unsplash.com/photo-1543294001-f7cd5d7fb516?auto=format&fit=crop&w=1600&q=80";

export function categorySecondaryImage(category: Category, site: SiteContent): string {
  const custom = site.categories?.[category]?.secondaryImage?.trim();
  if (custom && custom.length > 0) return custom;
  if (category === "bridal") return DEFAULT_BRIDAL_EDITORIAL;
  return DEFAULT_CATEGORY_IMAGES[category];
}

export function atelierImage(site: SiteContent): string {
  const custom = site.homepage?.atelierImage?.trim();
  return custom && custom.length > 0 ? custom : DEFAULT_ATELIER_IMAGE;
}

export function heroPosterImage(site: SiteContent): string {
  const custom = site.heroPoster?.trim();
  return custom && custom.length > 0 ? custom : HERO_POSTER;
}

export function featuredCollection(
  collections: Collection[],
  site: SiteContent,
): Collection | undefined {
  const slug = site.homepage?.featuredCollectionSlug?.trim();
  if (slug) {
    const found = collections.find((c) => c.slug === slug);
    if (found) return found;
  }
  return collections.find((c) => c.slug === "muhra-aurora") ?? collections[0];
}

export function featuredHomeProducts(products: Product[], site: SiteContent): Product[] {
  const ids = site.homepage?.featuredProductIds?.filter(Boolean) ?? [];
  if (ids.length > 0) {
    const map = new Map(products.map((p) => [p.id, p]));
    const picked = ids.map((id) => map.get(id)).filter((p): p is Product => Boolean(p));
    if (picked.length > 0) return picked;
  }
  return products
    .filter((p) => p.collection === "muhra-heritage" || p.isNew || p.isHighJewelry)
    .slice(0, 8);
}

/** Ensures nested keys exist when loading older localStorage snapshots. */
export function normalizeSiteContent(site: SiteContent): SiteContent {
  return {
    ...site,
    heroPoster: site.heroPoster ?? "",
    categories: site.categories ?? {},
    copyEn: site.copyEn ?? {},
    copyAr: site.copyAr ?? {},
    homepage: {
      featuredProductIds: site.homepage?.featuredProductIds ?? [],
      featuredCollectionSlug: site.homepage?.featuredCollectionSlug ?? "",
      atelierImage: site.homepage?.atelierImage ?? "",
    },
  };
}

/** Slug used for the homepage featured collection block (explicit pick or Maison default). */
export function featuredCollectionSlug(site: SiteContent): string {
  const slug = site.homepage?.featuredCollectionSlug?.trim();
  return slug || "muhra-aurora";
}
