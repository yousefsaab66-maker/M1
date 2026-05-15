"use client";

import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { SectionTitle } from "@/components/Section";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useStore } from "@/components/providers/StoreProvider";

export default function WishlistPage() {
  const { wishlist, products, hydrated } = useStore();
  const { t } = useLocale();
  const items = wishlist
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  return (
    <div className="page-gutter py-20 md:py-28">
      <SectionTitle eyebrow={t("nav.wishlist")} title={t("wishlist.title")} />
      <div className="mx-auto mt-16 max-w-[1400px]">
        {!hydrated ? (
          <div className="py-20 text-center opacity-60">…</div>
        ) : items.length === 0 ? (
          <div className="mx-auto max-w-md text-center py-12">
            <p className="opacity-80">{t("common.empty")}</p>
            <Link href={"/products" as never} className="btn-ghost mt-8 inline-flex">
              {t("common.viewAll")} →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-14 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-8">
            {items.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
