import type { Product, Category, Material, Stone, Currency } from "@/lib/catalog";

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
  description: string | null;
  story: string | null;
  related_slugs: string[] | null;
  sizes: string[] | null;
  is_high_jewelry: boolean;
  is_new: boolean;
};

export function rowToProduct(row: ProductRow): Product {
  return {
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
    description: row.description ?? "",
    story: row.story ?? "",
    related: row.related_slugs ?? [],
    sizes: row.sizes && row.sizes.length > 0 ? row.sizes : undefined,
    isHighJewelry: row.is_high_jewelry,
    isNew: row.is_new,
  };
}

export function productToInsert(p: Product) {
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
    description: p.description ?? "",
    story: p.story ?? "",
    related_slugs: p.related ?? [],
    sizes: p.sizes ?? null,
    is_high_jewelry: !!p.isHighJewelry,
    is_new: !!p.isNew,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isDatabaseProductId(id: string): boolean {
  return UUID_RE.test(id);
}
