import type { Product } from "@/lib/catalog";
import { rowToProduct, type ProductRow } from "@/lib/catalog-db";
import { sanitizeProductForCatalogApi } from "@/lib/product-media";
import { isSupabaseBackendConfigured, supabaseAdmin } from "@/lib/supabase/admin";

export type FetchCatalogProductsResult =
  | { kind: "ok"; products: Product[] }
  | { kind: "not_configured" }
  | { kind: "error"; message: string };

export type FetchCatalogProductsOptions = {
  /** Staff diagnostics only — public API must sanitize inline `data:` images. */
  rawImages?: boolean;
};

const LIST_SELECT =
  "id,slug,name,collection_slug,category,price,currency,materials,stones,images,sizes,is_high_jewelry,is_new";

function rowToProductList(row: ProductRow): Product {
  const images = row.images ?? [];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    collection: row.collection_slug,
    category: row.category as Product["category"],
    price: Number(row.price),
    currency: row.currency as Product["currency"],
    materials: (row.materials ?? []) as Product["materials"],
    stones: (row.stones ?? []) as Product["stones"],
    images: images.length > 0 ? [images[0]!] : [],
    description: "",
    story: "",
    related: [],
    sizes: row.sizes && row.sizes.length > 0 ? row.sizes : undefined,
    isHighJewelry: row.is_high_jewelry,
    isNew: row.is_new,
  };
}

/** Storefront list/cards — omits long text fields and extra gallery images. */
export async function fetchCatalogProductsForList(
  options?: FetchCatalogProductsOptions,
): Promise<FetchCatalogProductsResult> {
  if (!isSupabaseBackendConfigured()) return { kind: "not_configured" };
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("products")
      .select(LIST_SELECT)
      .order("created_at", { ascending: false });
    if (error) return { kind: "error", message: error.message };
    const rows = (data ?? []).map((r) => rowToProductList(r as ProductRow));
    const products = options?.rawImages ? rows : rows.map(sanitizeProductForCatalogApi);
    return { kind: "ok", products };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return { kind: "error", message: msg };
  }
}

/** Shared by `/api/catalog/products?full=1` and staff — full rows for PDP/editor. */
export async function fetchCatalogProducts(
  options?: FetchCatalogProductsOptions,
): Promise<FetchCatalogProductsResult> {
  if (!isSupabaseBackendConfigured()) return { kind: "not_configured" };
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.from("products").select("*").order("created_at", { ascending: false });
    if (error) return { kind: "error", message: error.message };
    const rows = (data ?? []).map((r) => rowToProduct(r as ProductRow));
    const products = options?.rawImages ? rows : rows.map(sanitizeProductForCatalogApi);
    return { kind: "ok", products };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return { kind: "error", message: msg };
  }
}

export async function fetchCatalogProductBySlug(
  slug: string,
  options?: FetchCatalogProductsOptions,
): Promise<
  | { kind: "ok"; product: Product }
  | { kind: "not_found" }
  | { kind: "not_configured" }
  | { kind: "error"; message: string }
> {
  if (!isSupabaseBackendConfigured()) return { kind: "not_configured" };
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.from("products").select("*").eq("slug", slug.trim()).maybeSingle();
    if (error) return { kind: "error", message: error.message };
    if (!data) return { kind: "not_found" };
    const product = options?.rawImages
      ? rowToProduct(data as ProductRow)
      : sanitizeProductForCatalogApi(rowToProduct(data as ProductRow));
    return { kind: "ok", product };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return { kind: "error", message: msg };
  }
}
