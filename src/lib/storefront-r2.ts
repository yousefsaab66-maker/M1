import {
  COLLECTIONS as SEED_COLLECTIONS,
  SITE_CONTENT as SEED_SITE,
  type Collection,
  type SiteContent,
} from "@/lib/catalog";
import { normalizeSiteContent } from "@/lib/site-display";
import { isStorableMediaUrl, sanitizeSiteContentForServer } from "@/lib/site-content-storage";
import { getMuhraMediaR2Binding } from "@/lib/r2-upload";
import { readSiteSettingsFromR2, SITE_SETTINGS_R2_KEY } from "@/lib/site-settings-r2";

export const STOREFRONT_R2_KEY = "site/storefront.json";

export type StorefrontPayload = {
  site: SiteContent;
  collections: Collection[];
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
  for (const c of collections) {
    const cover = c.coverImage?.trim() ?? "";
    const editorial = c.editorialImage?.trim() ?? "";
    if (cover && !isStorableMediaUrl(cover)) return { ok: false, error: "embedded_media" };
    if (editorial && !isStorableMediaUrl(editorial)) return { ok: false, error: "embedded_media" };
  }
  return { ok: true, collections };
}

async function readLegacySiteOnly(): Promise<SiteContent | null> {
  const legacy = await readSiteSettingsFromR2();
  if (legacy.ok && legacy.site) return legacy.site;
  return null;
}

export async function readStorefrontFromR2(): Promise<ReadStorefrontR2Result> {
  const bucket = await getMuhraMediaR2Binding();
  if (!bucket) return { ok: false, error: "r2_not_configured" };

  try {
    const obj = await bucket.get(STOREFRONT_R2_KEY);
    if (obj) {
      const parsed = JSON.parse(await obj.text()) as Partial<StorefrontPayload>;
      if (parsed?.site && Array.isArray(parsed.collections)) {
        return {
          ok: true,
          data: {
            site: normalizeSiteContent(parsed.site),
            collections: parsed.collections,
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

    const legacySite = await readLegacySiteOnly();
    if (legacySite) {
      return {
        ok: true,
        data: {
          site: legacySite,
          collections: SEED_COLLECTIONS,
          updatedAt: new Date().toISOString(),
        },
      };
    }

    return { ok: true, data: null };
  } catch {
    return { ok: false, error: "r2_read_failed" };
  }
}

export async function writeStorefrontToR2(
  patch: { site?: SiteContent; collections?: Collection[] },
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

  const siteSan = sanitizeSiteContentForServer(baseSite);
  if (!siteSan.ok) return { ok: false, error: "embedded_media" };

  const colSan = sanitizeCollectionsForServer(baseCollections);
  if (!colSan.ok) return { ok: false, error: "embedded_media" };

  const updatedAt = new Date().toISOString();
  const payload: StorefrontPayload = {
    site: siteSan.site,
    collections: colSan.collections,
    updatedAt,
  };

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
