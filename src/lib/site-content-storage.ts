import type { SiteContent } from "@/lib/catalog";
import { normalizeStaffMediaUrl } from "@/lib/staff-media-url";
import { normalizeDiscountCodes } from "@/lib/discount";
import { CATALOG_CATEGORIES, getShippingFeeIqd, getUsdIqdRate, normalizeSiteContent } from "@/lib/site-display";

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

  const heroPoster = normalizeStaffMediaUrl(normalized.heroPoster ?? "");
  if (heroPoster && !isStorableMediaUrl(heroPoster)) {
    rejected.push("heroPoster");
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
    const img2 = normalizeStaffMediaUrl(normalized.categories?.[key]?.secondaryImage ?? "");
    if (img2 && !isStorableMediaUrl(img2)) {
      rejected.push(`categories.${key}.secondaryImage`);
    }
  }

  for (const cat of normalized.customCategories ?? []) {
    const img = normalizeStaffMediaUrl(cat.image ?? "");
    if (img && !isStorableMediaUrl(img)) {
      rejected.push(`customCategories.${cat.slug}.image`);
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
    const secondaryImage = normalizeStaffMediaUrl(entry.secondaryImage ?? "");
    const label = entry.label?.trim() ?? "";
    if (!image && !label && !secondaryImage) continue;
    categories[key] = {
      label: label || undefined,
      image: image || undefined,
      secondaryImage: secondaryImage || undefined,
    };
  }

  const customCategories = (normalized.customCategories ?? [])
    .map((cat) => {
      const slug = cat.slug.trim();
      const labelAr = cat.labelAr.trim();
      const labelEn = cat.labelEn.trim();
      if (!slug || (!labelAr && !labelEn)) return null;
      const image = normalizeStaffMediaUrl(cat.image ?? "");
      return {
        id: cat.id || slug,
        slug,
        labelAr: labelAr || labelEn,
        labelEn: labelEn || labelAr,
        image: image || undefined,
        parentCategory: cat.parentCategory,
        showInHomeStrip: !!cat.showInHomeStrip,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const cleaned: SiteContent = {
    ...normalized,
    heroVideo: heroVideo || undefined,
    heroPoster: heroPoster || undefined,
    usdIqdRate: getUsdIqdRate(normalized),
    shippingFeeIqd: getShippingFeeIqd(normalized),
    discountCodes: normalizeDiscountCodes(normalized.discountCodes),
    categories,
    customCategories,
    homepage: {
      ...normalized.homepage,
      atelierImage: atelier,
    },
  };

  return { ok: true, site: cleaned };
}
