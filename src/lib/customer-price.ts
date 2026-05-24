import type { Currency } from "./catalog";
import type { Locale } from "./i18n";
import { formatIqd, toIqd, type ToIqdOptions } from "./iraq";

/** Product/order currency including IQD stored in Supabase. */
export type DisplayCurrency = Currency | "IQD";

export type CustomerPriceParts = {
  /** Locale-formatted IQD string (customer-facing display). */
  primary: string;
  iqdAmount: number;
};

/** IQD amount and formatted string for storefront UI (IQD only — no USD/EUR listing). */
export function getCustomerPriceParts(
  amount: number,
  currency: DisplayCurrency,
  locale: Locale,
  opts?: ToIqdOptions,
): CustomerPriceParts {
  const iqdAmount =
    currency === "IQD" ? Math.round(amount) : toIqd(amount, currency, opts);
  const primary = formatIqd(iqdAmount, locale);
  return { primary, iqdAmount };
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
