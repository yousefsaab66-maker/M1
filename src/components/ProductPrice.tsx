"use client";

import type { DisplayCurrency } from "@/lib/customer-price";
import { getCustomerPriceParts } from "@/lib/customer-price";
import { getUsdIqdRate } from "@/lib/site-display";
import { useStore } from "@/components/providers/StoreProvider";
import { useLocale } from "@/components/providers/LocaleProvider";

type ProductPriceProps = {
  amount: number;
  currency: DisplayCurrency;
  size?: "sm" | "md" | "lg";
  className?: string;
  align?: "start" | "end" | "center";
};

const SIZE_CLASS: Record<NonNullable<ProductPriceProps["size"]>, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
};

const ALIGN_CLASS: Record<NonNullable<ProductPriceProps["align"]>, string> = {
  start: "text-start",
  end: "text-end",
  center: "text-center",
};

export function ProductPrice({
  amount,
  currency,
  size = "sm",
  className = "",
  align = "center",
}: ProductPriceProps) {
  const { site } = useStore();
  const { locale } = useLocale();
  const usdIqdRate = getUsdIqdRate(site);
  const { primary } = getCustomerPriceParts(amount, currency, locale, {
    usdIqdRate,
  });
  const primaryClass = SIZE_CLASS[size];

  return (
    <div className={`${ALIGN_CLASS[align]} ${className}`.trim()}>
      <p className={primaryClass}>{primary}</p>
    </div>
  );
}
