import type { Currency } from "./catalog";
import type { Locale } from "./i18n";
import { formatPrice } from "./format";
import { formatIqd, toIqd, type ToIqdOptions } from "./iraq";

/** Product/order currency including IQD stored in Supabase. */
export type DisplayCurrency = Currency | "IQD";

export type CustomerPriceParts = {
  /** Locale-formatted IQD string (primary customer display). */
  primary: string;
  /** Original listing currency, when not IQD. */
  secondary: string | null;
  iqdAmount: number;
};

/** IQD amount and formatted primary/secondary strings for storefront UI. */
export function getCustomerPriceParts(
  amount: number,
  currency: DisplayCurrency,
  locale: Locale,
  opts?: ToIqdOptions,
): CustomerPriceParts {
  const iqdAmount =
    currency === "IQD" ? Math.round(amount) : toIqd(amount, currency, opts);
  const primary = formatIqd(iqdAmount, locale);
  const secondary =
    currency === "IQD" ? null : formatPrice(amount, currency, locale);
  return { primary, secondary, iqdAmount };
}

/** Primary IQD string only (line items, labels). */
export function formatCustomerPrice(
  amount: number,
  currency: DisplayCurrency,
  locale: Locale,
  opts?: ToIqdOptions,
): string {
  return getCustomerPriceParts(amount, currency, locale, opts).primary;
}
