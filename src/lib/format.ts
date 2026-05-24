import type { Currency } from "./catalog";
import type { Locale } from "./i18n";

const LOCALE_TO_INTL: Record<Locale, string> = {
  en: "en-US",
  fr: "fr-FR",
  it: "it-IT",
  es: "es-ES",
  ar: "ar-AE",
};

export { formatCustomerPrice, getCustomerPriceParts } from "./customer-price";
export type { CustomerPriceParts, DisplayCurrency } from "./customer-price";

/** Staff and raw currency formatting (not IQD-first storefront display). */
export function formatPrice(amount: number, currency: Currency, locale: Locale = "en") {
  try {
    return new Intl.NumberFormat(LOCALE_TO_INTL[locale] ?? "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export function formatDate(iso: string, locale: Locale = "en") {
  try {
    return new Intl.DateTimeFormat(LOCALE_TO_INTL[locale] ?? "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
