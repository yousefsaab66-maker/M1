"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { FadeIn, SectionTitle } from "@/components/Section";
import { useStore } from "@/components/providers/StoreProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  catalogFilterSlugs,
  productCategoryImage,
  productCategoryLabel,
} from "@/lib/site-display";

export default function CollectionsIndex() {
  const { collections, site } = useStore();
  const { t, locale } = useLocale();
  const categorySlugs = useMemo(() => catalogFilterSlugs(site), [site]);

  return (
    <div className="page-gutter py-20 md:py-28">
      <SectionTitle
        eyebrow={t("nav.collections")}
        title={t("collections.heading")}
        subtitle={t("collections.subtitle")}
      />

      <div className="mx-auto mt-16 max-w-[1400px]">
        <SectionTitle
          eyebrow={t("filter.category")}
          title={t("collections.categoriesTitle")}
          subtitle={t("collections.categoriesSubtitle")}
        />
        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
          {categorySlugs.map((slug, i) => (
            <FadeIn key={slug} delay={i * 0.04}>
              <Link
                href={`/products?category=${slug}` as never}
                className="product-image-zoom group relative block aspect-[3/4] overflow-hidden"
                style={{ background: "var(--surface-2)" }}
              >
                <Image
                  src={productCategoryImage(slug, site)}
                  alt={productCategoryLabel(slug, site, t, locale)}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                  className="object-cover"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: "linear-gradient(180deg, transparent 50%, rgba(10,10,10,0.55) 100%)",
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 p-5 text-[var(--color-ivory)]">
                  <h3 className="font-display text-xl md:text-2xl" style={{ color: "var(--color-ivory)" }}>
                    {productCategoryLabel(slug, site, t, locale)}
                  </h3>
                </div>
              </Link>
            </FadeIn>
          ))}
        </div>
      </div>

      <div className="divider-gold mx-auto my-16 w-[40%]" />

      <div className="mx-auto max-w-[1400px]">
        <SectionTitle eyebrow={t("nav.collections")} title={t("collections.heading")} />
        <div className="mt-12 grid gap-12 md:grid-cols-2">
          {collections.map((c, i) => (
            <FadeIn key={c.id} delay={i * 0.07}>
              <Link href={`/collections/${c.slug}` as never} className="group block">
                <div
                  className="product-image-zoom relative aspect-[4/5] overflow-hidden"
                  style={{ background: "var(--surface-2)" }}
                >
                  <Image
                    src={c.coverImage}
                    alt={c.name}
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover"
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.55))" }}
                  />
                  <div className="absolute inset-x-0 bottom-0 p-8 text-[var(--color-ivory)]">
                    <p className="eyebrow" style={{ color: "var(--color-gold)" }}>
                      {t("nav.collections")}
                    </p>
                    <h3 className="font-display mt-3 text-4xl md:text-5xl" style={{ color: "var(--color-ivory)" }}>
                      {c.name}
                    </h3>
                    <p className="mt-2 italic opacity-90">{c.tagline}</p>
                  </div>
                </div>
              </Link>
            </FadeIn>
          ))}
        </div>
      </div>
    </div>
  );
}
