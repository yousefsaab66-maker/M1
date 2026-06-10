import {
  BOUTIQUES as SEED_BOUTIQUES,
  COLLECTIONS as SEED_COLLECTIONS,
  JOURNAL as SEED_JOURNAL,
  SITE_CONTENT as SEED_SITE,
  type Boutique,
  type Collection,
  type JournalArticle,
  type Product,
  type SiteContent,
} from "@/lib/catalog";
import { fetchCatalogProductsForList } from "@/lib/catalog-products-query";
import { normalizeSiteContent } from "@/lib/site-display";
import { normalizeStaffMediaUrl } from "@/lib/staff-media-url";
import { isStorableMediaUrl, sanitizeSiteContentForServer } from "@/lib/site-content-storage";
import { getMuhraMediaR2Binding } from "@/lib/r2-upload";
import { SITE_SETTINGS_R2_KEY } from "@/lib/site-settings-r2";

export const STOREFRONT_R2_KEY = "site/storefront.json";

/** Slim product rows embedded in storefront.json (CDN) — same shape as list API. */
export type StorefrontCatalogProduct = Product;

export type StorefrontPayload = {
  site: SiteContent;
  collections: Collection[];
  journal: JournalArticle[];
  boutiques: Boutique[];
  /** Light catalog for store visitors (no Worker products API on first paint). */
  catalogProducts?: StorefrontCatalogProduct[];
  updatedAt: string;
};

export type ReadStorefrontR2Result =
  | { ok: true; data: StorefrontPayload }
  | { ok: true; data: null }
  | { ok: false; error: "r2_not_configured" | "r2_read_failed" };

export type WriteStorefrontR2Result =
  | { ok: true; updatedAt: string }
  | { ok: false; error: string };

function sanitizeCollectionsForServer(
  collections: Collection[],
): { ok: true; collections: Collection[] } | { ok: false; error: "embedded_media" } {
  const normalized = collections.map((c) => ({
    ...c,
    coverImage: normalizeStaffMediaUrl(c.coverImage ?? ""),
    editorialImage: normalizeStaffMediaUrl(c.editorialImage ?? ""),
  }));
  for (const c of normalized) {
    if (c.coverImage && !isStorableMediaUrl(c.coverImage)) return { ok: false, error: "embedded_media" };
    if (c.editorialImage && !isStorableMediaUrl(c.editorialImage))
      return { ok: false, error: "embedded_media" };
  }
  return { ok: true, collections: normalized };
}

function sanitizeJournalForServer(
  journal: JournalArticle[],
): { ok: true; journal: JournalArticle[] } | { ok: false; error: "embedded_media" } {
  const normalized = journal.map((a) => ({
    ...a,
    image: normalizeStaffMediaUrl(a.image ?? ""),
  }));
  for (const a of normalized) {
    if (a.image && !isStorableMediaUrl(a.image)) return { ok: false, error: "embedded_media" };
  }
  return { ok: true, journal: normalized };
}

function sanitizeBoutiquesForServer(
  boutiques: Boutique[],
): { ok: true; boutiques: Boutique[] } | { ok: false; error: "embedded_media" } {
  const normalized = boutiques.map((b) => ({
    ...b,
    image: normalizeStaffMediaUrl(b.image ?? ""),
  }));
  for (const b of normalized) {
    if (b.image && !isStorableMediaUrl(b.image)) return { ok: false, error: "embedded_media" };
  }
  return { ok: true, boutiques: normalized };
}

export async function readStorefrontFromR2(): Promise<ReadStorefrontR2Result> {
  const bucket = await getMuhraMediaR2Binding();
  if (!bucket) return { ok: false, error: "r2_not_configured" };

  try {
    const obj = await bucket.get(STOREFRONT_R2_KEY);
    if (obj) {
      const parsed = JSON.parse(await obj.text()) as Partial<StorefrontPayload>;
      if (parsed?.site && Array.isArray(parsed.collections)) {
        const catalogProducts = Array.isArray(parsed.catalogProducts)
          ? (parsed.catalogProducts as StorefrontCatalogProduct[])
          : undefined;
        return {
          ok: true,
          data: {
            site: normalizeSiteContent(parsed.site),
            collections: parsed.collections,
            journal: Array.isArray(parsed.journal) ? parsed.journal : SEED_JOURNAL,
            boutiques: Array.isArray(parsed.boutiques) ? parsed.boutiques : SEED_BOUTIQUES,
            catalogProducts:
              catalogProducts && catalogProducts.length > 0 ? catalogProducts : undefined,
            updatedAt:
              typeof parsed.updatedAt === "string"
                ? parsed.updatedAt
                : obj.uploaded instanceof Date
                  ? obj.uploaded.toISOString()
                  : new Date().toISOString(),
          },
        };
      }
    }

    const legacyObj = await bucket.get(SITE_SETTINGS_R2_KEY);
    if (legacyObj) {
      const legacyParsed = JSON.parse(await legacyObj.text()) as SiteContent;
      if (legacyParsed && typeof legacyParsed === "object") {
        return {
          ok: true,
          data: {
            site: normalizeSiteContent(legacyParsed),
            collections: SEED_COLLECTIONS,
            journal: SEED_JOURNAL,
            boutiques: SEED_BOUTIQUES,
            updatedAt:
              legacyObj.uploaded instanceof Date ? legacyObj.uploaded.toISOString() : new Date().toISOString(),
          },
        };
      }
    }

    return { ok: true, data: null };
  } catch {
    return { ok: false, error: "r2_read_failed" };
  }
}

export async function writeStorefrontToR2(
  patch: {
    site?: SiteContent;
    collections?: Collection[];
    journal?: JournalArticle[];
    boutiques?: Boutique[];
  },
): Promise<WriteStorefrontR2Result> {
  const bucket = await getMuhraMediaR2Binding();
  if (!bucket) return { ok: false, error: "r2_not_configured" };

  const current = await readStorefrontFromR2();
  const baseSite =
    patch.site ??
    (current.ok && current.data ? current.data.site : null) ??
    normalizeSiteContent(SEED_SITE);
  const baseCollections =
    patch.collections ?? (current.ok && current.data ? current.data.collections : null) ?? SEED_COLLECTIONS;
  const baseJournal =
    patch.journal ?? (current.ok && current.data ? current.data.journal : null) ?? SEED_JOURNAL;
  const baseBoutiques =
    patch.boutiques ?? (current.ok && current.data ? current.data.boutiques : null) ?? SEED_BOUTIQUES;

  const siteSan = sanitizeSiteContentForServer(baseSite);
  if (!siteSan.ok) return { ok: false, error: "embedded_media" };

  const colSan = sanitizeCollectionsForServer(baseCollections);
  if (!colSan.ok) return { ok: false, error: "embedded_media" };

  const journalSan = sanitizeJournalForServer(baseJournal);
  if (!journalSan.ok) return { ok: false, error: "embedded_media" };

  const boutiquesSan = sanitizeBoutiquesForServer(baseBoutiques);
  if (!boutiquesSan.ok) return { ok: false, error: "embedded_media" };

  const updatedAt = new Date().toISOString();
  const catalogResult = await fetchCatalogProductsForList();
  const catalogProducts =
    catalogResult.kind === "ok"
      ? catalogResult.products
      : current.ok && current.data?.catalogProducts
        ? current.data.catalogProducts
        : undefined;

  const payload: StorefrontPayload = {
    site: siteSan.site,
    collections: colSan.collections,
    journal: journalSan.journal,
    boutiques: boutiquesSan.boutiques,
    updatedAt,
  };
  if (catalogResult.kind === "ok") {
    payload.catalogProducts = catalogProducts ?? [];
  } else if (catalogProducts && catalogProducts.length > 0) {
    payload.catalogProducts = catalogProducts;
  }

  try {
    await bucket.put(STOREFRONT_R2_KEY, JSON.stringify(payload), {
      httpMetadata: {
        contentType: "application/json; charset=utf-8",
        cacheControl: "public, max-age=60",
      },
    });
    return { ok: true, updatedAt };
  } catch {
    return { ok: false, error: "r2_write_failed" };
  }
}

/** @deprecated Legacy key — migrated into storefront on next save. */
export { SITE_SETTINGS_R2_KEY };
