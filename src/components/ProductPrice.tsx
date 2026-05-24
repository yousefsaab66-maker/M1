"use client";

import type { Currency } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { formatIqd, toIqd } from "@/lib/iraq";
import { getUsdIqdRate } from "@/lib/site-display";
import { useStore } from "@/components/providers/StoreProvider";
import { useLocale } from "@/components/providers/LocaleProvider";

type ProductPriceProps = {
  amount: number;
  currency: Currency;
  size?: "sm" | "md" | "lg";
  className?: string;
  showIqdHint?: boolean;
};

const SIZE_CLASS: Record<NonNullable<ProductPriceProps["size"]>, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
};

export function ProductPrice({
  amount,
  currency,
  size = "sm",
  className = "",
  showIqdHint = true,
}: ProductPriceProps) {
  const { site } = useStore();
  const { locale, t } = useLocale();
  const usdIqdRate = getUsdIqdRate(site);
  const iqd = toIqd(amount, currency, { usdIqdRate });
  const primaryClass = SIZE_CLASS[size];

  return (
    <div className={className}>
      <p className={primaryClass}>{formatPrice(amount, currency, locale)}</p>
      {showIqdHint && (
        <p className="mt-0.5 text-[11px] opacity-65">
          {t("price.approxIqd").replace("{amount}", formatIqd(iqd, locale))}
        </p>
      )}
    </div>
  );
}
