"use client";

import { useLocale } from "@/components/providers/LocaleProvider";

type SoldOutBadgeVariant = "overlay" | "banner";

interface SoldOutBadgeProps {
  variant?: SoldOutBadgeVariant;
}

/** Prominent sold-out indicator for catalog cards, PDP gallery, and buy column. */
export function SoldOutBadge({ variant = "overlay" }: SoldOutBadgeProps) {
  const { t } = useLocale();

  if (variant === "banner") {
    return (
      <div
        role="status"
        className="rounded-sm border px-4 py-3 text-sm leading-relaxed"
        style={{
          borderColor: "color-mix(in srgb, var(--color-bordeaux) 45%, transparent)",
          background: "color-mix(in srgb, var(--color-bordeaux) 8%, var(--surface))",
          color: "var(--color-bordeaux)",
        }}
      >
        <p className="font-display text-base">{t("product.soldOutBadge")}</p>
        <p className="mt-1 text-[12px] opacity-90">{t("product.soldOutBanner")}</p>
      </div>
    );
  }

  return (
    <>
      <span
        className="pointer-events-none absolute inset-0 z-[5] bg-[var(--color-onyx)]/30"
        aria-hidden
      />
      <span className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center p-4">
        <span
          className="px-5 py-2.5 text-center font-display text-base font-medium tracking-wide md:text-lg"
          style={{
            background: "color-mix(in srgb, var(--color-bordeaux) 94%, transparent)",
            color: "var(--color-ivory)",
            border: "1px solid color-mix(in srgb, var(--color-ivory) 30%, transparent)",
            boxShadow: "0 10px 40px color-mix(in srgb, var(--color-onyx) 45%, transparent)",
          }}
        >
          {t("product.soldOutBadge")}
        </span>
      </span>
    </>
  );
}
