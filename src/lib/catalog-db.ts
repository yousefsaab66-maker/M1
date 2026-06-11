import type { Product, Material, Stone, Currency } from "@/lib/catalog";
import { ensureProductOrderable } from "@/lib/product-media";
import {
  flattenSizeOptions,
  normalizeSizeOptions,
  resolveProductSizes,
  sizeOptionsFromRow,
  type ProductSizeOptions,
} from "@/lib/product-sizes";

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  collection_slug: string;
  category: string;
  price: number | string;
  currency: string;
  materials: string[] | null;
  stones: string[] | null;
  images: string[] | null;
  videos?: string[] | null;
  description: string | null;
  story: string | null;
  related_slugs: string[] | null;
  sizes: string[] | null;
  size_options: ProductSizeOptions | null;
  is_high_jewelry: boolean;
  is_new: boolean;
};

export function rowToProduct(row: ProductRow): Product {
  const videos = row.videos && row.videos.length > 0 ? row.videos : undefined;
  const sizeOptions = sizeOptionsFromRow(row.size_options, row.sizes, row.category);
  const resolvedSizes = resolveProductSizes(
    { category: row.category, sizeOptions, sizes: row.sizes ?? undefined } as Product,
  );
  return ensureProductOrderable({
    id: row.id,
    slug: row.slug,
    name: row.name,
    collection: row.collection_slug,
    category: row.category,
    price: Number(row.price),
    currency: row.currency as Currency,
    materials: (row.materials ?? []) as Material[],
    stones: (row.stones ?? []) as Stone[],
    images: row.images ?? [],
    videos,
    description: row.description ?? "",
    story: row.story ?? "",
    related: row.related_slugs ?? [],
    sizeOptions,
    sizes: resolvedSizes.length > 0 ? resolvedSizes : undefined,
    isHighJewelry: row.is_high_jewelry,
    isNew: row.is_new,
  });
}

export function productToInsert(p: Product) {
  const sizeOptions = normalizeSizeOptions(p.sizeOptions);
  const flatSizes = flattenSizeOptions(sizeOptions);
  const legacySizes =
    flatSizes.length > 0
      ? flatSizes
      : [...new Set((p.sizes ?? []).map((s) => s.trim()).filter(Boolean))];
  return {
    slug: p.slug.trim(),
    name: p.name.trim(),
    collection_slug: p.collection,
    category: p.category,
    price: p.price,
    currency: p.currency,
    materials: p.materials,
    stones: p.stones,
    images: p.images,
    videos: p.videos ?? [],
    description: p.description ?? "",
    story: p.story ?? "",
    related_slugs: p.related ?? [],
    size_options: sizeOptions ?? null,
    sizes: legacySizes.length > 0 ? legacySizes : null,
    is_high_jewelry: !!p.isHighJewelry,
    is_new: !!p.isNew,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isDatabaseProductId(id: string): boolean {
  return UUID_RE.test(id);
}

/** Drop tmp-* rows when a Supabase row exists for the same slug (post-save duplicate fix). */
export function stripOptimisticProductDuplicates(products: Product[]): Product[] {
  const dbSlugs = new Set(
    products.filter((p) => isDatabaseProductId(p.id) && p.slug).map((p) => p.slug),
  );
  if (dbSlugs.size === 0) return products;
  return products.filter(
    (p) => isDatabaseProductId(p.id) || !p.slug || !dbSlugs.has(p.slug),
  );
}
