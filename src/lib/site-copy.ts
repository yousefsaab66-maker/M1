import type { SiteContent } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n";

/** i18n keys staff may override per locale (stored in R2 `site.copyEn` / `site.copyAr`). */
export const SITE_COPY_KEYS = [
  "ticker.line1",
  "ticker.line2",
  "ticker.line3",
  "ticker.line4",
  "nav.collections",
  "nav.high-jewelry",
  "nav.watches",
  "nav.bridal",
  "nav.story",
  "nav.journal",
  "nav.boutiques",
  "story.title",
  "story.lede",
  "home.atelier.bodyExtra",
  "home.atelier.parisCaption",
  "home.fromMaison",
  "home.boutiques.cities",
  "boutiques.title",
  "boutiques.sub",
  "home.newsletter.title",
  "common.newsletter.copy",
  "common.iconic",
  "hero.sub",
  "hero.cta",
  "hero.cta2",
  "footer.services",
  "footer.maison",
  "footer.legal",
  "footer.bookAppointment",
  "footer.contact",
  "footer.repair",
  "footer.shipping",
  "footer.story",
  "footer.craftsmanship",
  "footer.heritage",
  "footer.terms",
  "footer.privacy",
  "footer.cookies",
  "common.allRights",
  "common.returns",
  "product.returns.body",
] as const;

/** Legacy return-policy phrases — strip from R2 bundles so i18n exchange policy wins. */
const LEGACY_RETURNS_BODY_MARKERS = [
  "14 يوم",
  "14 يومًا",
  "رسوم الشحن غير مستردة",
  "فاتورة الشراء",
  "نحن نقبل",
  "30 يوم",
  "30 يوماً",
  "Returns accepted within 30",
  "Retours acceptés sous 30",
  "Resi accettati entro 30",
  "Devoluciones aceptadas en 30",
  "يُقبل الإرجاع خلال 30",
  "Complimentary, insured shipping worldwide. Returns accepted",
  "Livraison offerte et assurée dans le monde entier. Retours",
  "Spedizione gratuita e assicurata in tutto il mondo. Resi",
  "Envío gratuito y asegurado en todo el mundo. Devoluciones",
  "شحنٌ مجّاني ومُؤمَّن",
] as const;

const LEGACY_RETURNS_TITLE_MARKERS = ["الإرجاع", "Returns", "Retours", "Resi", "Devoluciones"] as const;

export type SiteCopyKey = (typeof SITE_COPY_KEYS)[number];
export type SiteCopyBundle = Partial<Record<SiteCopyKey, string>>;

export const SITE_COPY_GROUPS: { id: string; labelKey: string; keys: SiteCopyKey[] }[] = [
  {
    id: "ticker",
    labelKey: "staff.copy.groupTicker",
    keys: ["ticker.line1", "ticker.line2", "ticker.line3", "ticker.line4"],
  },
  {
    id: "nav",
    labelKey: "staff.copy.groupNav",
    keys: [
      "nav.collections",
      "nav.high-jewelry",
      "nav.watches",
      "nav.bridal",
      "nav.story",
      "nav.journal",
      "nav.boutiques",
    ],
  },
  {
    id: "home",
    labelKey: "staff.copy.groupHome",
    keys: [
      "story.title",
      "story.lede",
      "home.atelier.bodyExtra",
      "home.atelier.parisCaption",
      "home.fromMaison",
      "home.boutiques.cities",
      "boutiques.title",
      "boutiques.sub",
      "home.newsletter.title",
      "common.newsletter.copy",
      "common.iconic",
      "hero.sub",
      "hero.cta",
      "hero.cta2",
    ],
  },
  {
    id: "product",
    labelKey: "staff.copy.groupProduct",
    keys: ["common.returns", "product.returns.body"],
  },
  {
    id: "footer",
    labelKey: "staff.copy.groupFooter",
    keys: [
      "footer.services",
      "footer.maison",
      "footer.legal",
      "footer.bookAppointment",
      "footer.contact",
      "footer.repair",
      "footer.shipping",
      "footer.story",
      "footer.craftsmanship",
      "footer.heritage",
      "footer.terms",
      "footer.privacy",
      "footer.cookies",
      "common.allRights",
    ],
  },
];

function isLegacyReturnsBody(value: string | undefined): boolean {
  const v = value?.trim() ?? "";
  if (!v) return false;
  return LEGACY_RETURNS_BODY_MARKERS.some((m) => v.includes(m));
}

function isLegacyReturnsTitle(value: string | undefined): boolean {
  const v = value?.trim() ?? "";
  if (!v) return false;
  return LEGACY_RETURNS_TITLE_MARKERS.includes(v as (typeof LEGACY_RETURNS_TITLE_MARKERS)[number]);
}

function withoutLegacyReturnsCopy(bundle: SiteCopyBundle | undefined): SiteCopyBundle | undefined {
  if (!bundle) return bundle;
  const body = bundle["product.returns.body"];
  const title = bundle["common.returns"];
  if (!isLegacyReturnsBody(body) && !isLegacyReturnsTitle(title)) return bundle;
  const next = { ...bundle };
  if (isLegacyReturnsBody(body)) delete next["product.returns.body"];
  if (isLegacyReturnsTitle(title)) delete next["common.returns"];
  return Object.keys(next).length > 0 ? next : undefined;
}

export function bundleForLocale(site: SiteContent, locale: Locale): SiteCopyBundle | undefined {
  const raw = locale === "ar" ? site.copyAr : site.copyEn;
  return withoutLegacyReturnsCopy(raw);
}

/** Storefront string: staff override → built-in i18n for active locale. */
export function siteCopy(
  site: SiteContent,
  locale: Locale,
  key: SiteCopyKey,
  t: (key: string) => string,
): string {
  const custom = bundleForLocale(site, locale)?.[key]?.trim();
  if (custom) return custom;
  const fallback = t(key);
  return fallback === key ? "" : fallback;
}

export function patchSiteCopyBundle(
  site: SiteContent,
  locale: "en" | "ar",
  key: SiteCopyKey,
  value: string,
): SiteContent {
  const field = locale === "ar" ? "copyAr" : "copyEn";
  const prev = site[field] ?? {};
  const next = { ...prev, [key]: value };
  if (!value.trim()) delete next[key];
  return { ...site, [field]: Object.keys(next).length > 0 ? next : undefined };
}
