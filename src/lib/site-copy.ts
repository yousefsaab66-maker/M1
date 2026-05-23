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
] as const;

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

export function bundleForLocale(site: SiteContent, locale: Locale): SiteCopyBundle | undefined {
  return locale === "ar" ? site.copyAr : site.copyEn;
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
