"use client";

import Image from "next/image";
import { ProductCard } from "@/components/ProductCard";
import { FadeIn, SectionTitle } from "@/components/Section";
import { useStore } from "@/components/providers/StoreProvider";
import { useLocale } from "@/components/providers/LocaleProvider";

export default function WatchesPage() {
  const { products } = useStore();
  const { t } = useLocale();
  const watches = products.filter((p) => p.category === "watches");
  return (
    <div>
      <section className="relative h-[55svh] min-h-[420px] overflow-hidden" style={{ background: "var(--color-onyx)" }}>
        <Image
          src="https://images.unsplash.com/photo-1622398925373-3f91b1e275f5?auto=format&fit=crop&w=2400&q=80"
          alt={t("nav.watches")}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.55))" }} />
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center" style={{ color: "var(--color-ivory)" }}>
          <p className="eyebrow" style={{ color: "var(--color-gold)" }}>{t("nav.watches")}</p>
          <h1 className="font-display mt-5 text-5xl md:text-7xl">{t("watches.title")}</h1>
          <p className="mt-4 max-w-xl italic opacity-85">{t("watches.tagline")}</p>
        </div>
      </section>

      <section className="page-gutter py-20 md:py-28">
        <SectionTitle eyebrow={t("nav.watches")} title={t("watches.heading")} subtitle={t("watches.subtitle")} />
        <FadeIn>
          <div className="mx-auto mt-16 grid max-w-[1400px] grid-cols-2 gap-x-5 gap-y-14 md:grid-cols-3 lg:gap-x-8">
            {watches.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </FadeIn>
      </section>
    </div>
  );
}
