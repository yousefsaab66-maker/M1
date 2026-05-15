import type { SiteContent } from "@/lib/catalog";
import { normalizeStaffMediaUrl } from "@/lib/staff-media-url";
import { CATALOG_CATEGORIES, normalizeSiteContent } from "@/lib/site-display";

export type SanitizeSiteResult =
  | { ok: true; site: SiteContent }
  | { ok: false; error: "embedded_media"; fields: string[] };

/** Reject data:/blob: URLs — only https/http (R2 public URLs) may be stored in Supabase. */
export function isStorableMediaUrl(url: string | undefined): boolean {
  const v = url?.trim() ?? "";
  if (v === "") return true;
  if (v.startsWith("data:") || v.startsWith("blob:")) return false;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Strip non-HTTP(S) media URLs before persisting site settings. */
export function sanitizeSiteContentForServer(site: SiteContent): SanitizeSiteResult {
  const normalized = normalizeSiteContent(site);
  const rejected: string[] = [];

  const heroVideo = normalizeStaffMediaUrl(normalized.heroVideo ?? "");
  if (heroVideo && !isStorableMediaUrl(heroVideo)) {
    rejected.push("heroVideo");
  }

  const atelier = normalizeStaffMediaUrl(normalized.homepage?.atelierImage ?? "");
  if (atelier && !isStorableMediaUrl(atelier)) {
    rejected.push("homepage.atelierImage");
  }

  for (const key of CATALOG_CATEGORIES) {
    const img = normalizeStaffMediaUrl(normalized.categories?.[key]?.image ?? "");
    if (img && !isStorableMediaUrl(img)) {
      rejected.push(`categories.${key}.image`);
    }
  }

  if (rejected.length > 0) {
    return { ok: false, error: "embedded_media", fields: rejected };
  }

  const categories: NonNullable<SiteContent["categories"]> = {};
  for (const key of CATALOG_CATEGORIES) {
    const entry = normalized.categories?.[key];
    if (!entry) continue;
    const image = normalizeStaffMediaUrl(entry.image ?? "");
    const label = entry.label?.trim() ?? "";
    if (!image && !label) continue;
    categories[key] = { label: label || undefined, image: image || undefined };
  }

  const cleaned: SiteContent = {
    ...normalized,
    heroVideo: heroVideo || undefined,
    categories,
    homepage: {
      ...normalized.homepage,
      atelierImage: atelier,
    },
  };

  return { ok: true, site: cleaned };
}
