"use client";

import Image from "next/image";
import { ProductCard } from "@/components/ProductCard";
import { FadeIn } from "@/components/Section";
import { useStore } from "@/components/providers/StoreProvider";
import { useLocale } from "@/components/providers/LocaleProvider";

export default function BridalPage() {
  const { products } = useStore();
  const { t } = useLocale();
  const bridal = products.filter((p) => p.category === "bridal");
  return (
    <div>
      <section className="relative h-[70svh] min-h-[500px] overflow-hidden" style={{ background: "var(--color-onyx)" }}>
        <Image
          src="https://images.unsplash.com/photo-1503236823255-94609f598e71?auto=format&fit=crop&w=1600&q=80"
          alt={t("nav.bridal")}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.3), rgba(0,0,0,0.5))" }} />
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center" style={{ color: "var(--color-ivory)" }}>
          <p className="eyebrow" style={{ color: "var(--color-gold)" }}>{t("nav.bridal")}</p>
          <h1 className="font-display mt-5 text-5xl md:text-7xl">{t("bridal.title")}</h1>
          <p className="mt-4 max-w-xl italic opacity-90">{t("bridal.tagline")}</p>
        </div>
      </section>

      <section className="page-gutter py-20 md:py-28">
        <div className="mx-auto grid max-w-[1400px] gap-12 lg:grid-cols-2 lg:gap-24">
          <FadeIn>
            <div className="relative aspect-[4/5]" style={{ background: "var(--surface-2)" }}>
              <Image
                src="https://images.unsplash.com/photo-1543294001-f7cd5d7fb516?auto=format&fit=crop&w=1600&q=80"
                alt=""
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div>
              <p className="eyebrow">{t("nav.bridal")}</p>
              <h2 className="font-display mt-5 text-4xl md:text-5xl">{t("bridal.editorial.title")}</h2>
              <p className="mt-7 leading-relaxed opacity-85">
                {t("bridal.editorial.body1")}
              </p>
              <p className="mt-5 leading-relaxed opacity-75">
                {t("bridal.editorial.body2")}
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="page-gutter pb-24 md:pb-32" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-[1400px] py-20">
          <h3 className="font-display text-3xl md:text-4xl">{t("bridal.creations")}</h3>
          <div className="mt-12 grid grid-cols-2 gap-x-5 gap-y-14 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-8">
            {bridal.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
