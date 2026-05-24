import type { Locale } from "./i18n";

/**
 * The eighteen governorates of the Republic of Iraq.
 * Codes are stable and locale-independent — they're stored on the order.
 * The labels are looked up via i18n at the `governorate.<code>` key.
 */
export const IRAQ_GOVERNORATES = [
  "baghdad",
  "basra",
  "nineveh",
  "erbil",
  "sulaymaniyah",
  "duhok",
  "najaf",
  "karbala",
  "wasit",
  "maysan",
  "dhi-qar",
  "babil",
  "diyala",
  "anbar",
  "saladin",
  "kirkuk",
  "muthanna",
  "qadisiyyah",
] as const;

export type GovernorateCode = (typeof IRAQ_GOVERNORATES)[number];

/** Static demo conversion rate used for IQD line on order summaries. */
export const IQD_PER_USD = 1310;
export const IQD_PER_EUR = 1430;
export const IQD_PER_AED = 357;
export const IQD_PER_JPY = 8.7;

/** Static flat shipping fee in IQD. */
export const SHIPPING_FEE_IQD = 5000;

export type ToIqdOptions = {
  /** Staff-set IQD per 1 USD; falls back to {@link IQD_PER_USD}. */
  usdIqdRate?: number;
};

function resolveUsdIqdRate(usdIqdRate?: number): number {
  if (typeof usdIqdRate === "number" && Number.isFinite(usdIqdRate) && usdIqdRate > 0) {
    return Math.round(usdIqdRate);
  }
  return IQD_PER_USD;
}

/** Convert a primary-currency amount to a rough IQD figure for display. */
export function toIqd(
  amount: number,
  currency: "EUR" | "USD" | "AED" | "JPY",
  opts?: ToIqdOptions,
): number {
  const usdRate = resolveUsdIqdRate(opts?.usdIqdRate);
  switch (currency) {
    case "USD":
      return Math.round(amount * usdRate);
    case "EUR":
      return Math.round(amount * IQD_PER_EUR);
    case "AED":
      return Math.round(amount * IQD_PER_AED);
    case "JPY":
      return Math.round(amount * IQD_PER_JPY);
    default:
      return Math.round(amount * usdRate);
  }
}

/** Locale-aware IQD formatter (no decimals — IQD has no minor unit in practice). */
export function formatIqd(amount: number, locale: Locale = "en"): string {
  const intl = locale === "ar" ? "ar-IQ" : "en-US";
  try {
    return new Intl.NumberFormat(intl, {
      style: "currency",
      currency: "IQD",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `IQD ${amount.toLocaleString()}`;
  }
}

/**
 * Iraqi mobile phone normaliser/validator.
 * Accepts:
 *   07XXXXXXXXX
 *   +9647XXXXXXXXX
 *   009647XXXXXXXXX
 * Returns the E.164-style canonical form starting with `+964...`, or `null` if invalid.
 */
export function normalizeIraqiPhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, "");
  const match = cleaned.match(/^(?:\+?964|00964|0)?(7\d{9})$/);
  if (!match) return null;
  return `+964${match[1]}`;
}

export const IRAQI_PHONE_REGEX = /^(?:\+?964|00964|0)?7\d{9}$/;

export { isIraqCountry } from "./countries";
