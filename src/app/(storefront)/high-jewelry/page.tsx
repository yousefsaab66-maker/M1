"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { FadeIn } from "@/components/Section";
import { useStore } from "@/components/providers/StoreProvider";
import { useLocale } from "@/components/providers/LocaleProvider";

export default function HighJewelryPage() {
  const { products, collections } = useStore();
  const { t } = useLocale();
  const reduce = useReducedMotion();
  const [scroll, setScroll] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduce) return;
    const onScroll = () => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const winH = window.innerHeight;
      const v = Math.min(Math.max((winH - r.top) / (winH + r.height), 0), 1);
      setScroll(v);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduce]);

  const lumiere = collections.find((c) => c.slug === "muhra-lumiere");
  const hj = products.filter((p) => p.isHighJewelry || p.collection === "muhra-lumiere");

  return (
    <div>
      <section ref={ref} className="relative h-[80svh] min-h-[560px] overflow-hidden" style={{ background: "var(--color-onyx)" }}>
        <motion.div
          className="absolute inset-0"
          animate={reduce ? undefined : { y: scroll * -60 }}
          transition={{ type: "tween", duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
        >
          <Image
            src="https://images.unsplash.com/photo-1620656798579-1984d9e87df7?auto=format&fit=crop&w=2400&q=80"
            alt={t("nav.high-jewelry")}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </motion.div>
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.65) 100%)" }} />
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center" style={{ color: "var(--color-ivory)" }}>
          <p className="eyebrow" style={{ color: "var(--color-gold)" }}>{t("nav.high-jewelry")}</p>
          <h1 className="font-display mt-6 text-5xl md:text-7xl xl:text-8xl">{lumiere?.name ?? t("hj.fallback")}</h1>
          <p className="mt-5 max-w-xl italic opacity-90">{lumiere?.tagline}</p>
        </div>
      </section>

      <section className="page-gutter py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn>
            <p className="editorial-quote">
              &ldquo;{t("hj.quote")}&rdquo;
            </p>
            <p className="mt-6 eyebrow">{t("hj.quoteAttr")}</p>
          </FadeIn>
        </div>
      </section>

      <section className="grid lg:grid-cols-2">
        <FadeIn className="relative aspect-[4/5] overflow-hidden lg:aspect-auto">
          <Image src="https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=1600&q=80" alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
        </FadeIn>
        <FadeIn className="flex items-center justify-center px-6 py-16 md:px-12">
          <div className="max-w-md">
            <p className="eyebrow">{t("hj.atelier.eyebrow")}</p>
            <h3 className="font-display mt-5 text-4xl">{t("hj.atelier.title")}</h3>
            <p className="mt-7 leading-relaxed opacity-85">
              {t("hj.atelier.body")}
            </p>
            <Link href={"/journal/lumiere-eighteen-months" as never} className="btn-ghost mt-10">
              {t("hj.readJournal")} →
            </Link>
          </div>
        </FadeIn>
      </section>

      <section className="grid lg:grid-cols-2" style={{ background: "var(--surface)" }}>
        <FadeIn className="order-2 flex items-center justify-center px-6 py-16 md:px-12 lg:order-1">
          <div className="max-w-md">
            <p className="eyebrow">{t("hj.provenance.eyebrow")}</p>
            <h3 className="font-display mt-5 text-4xl">{t("hj.provenance.title")}</h3>
            <p className="mt-7 leading-relaxed opacity-85">
              {t("hj.provenance.body")}
            </p>
            <Link href={"/journal/stones-and-their-stories" as never} className="btn-ghost mt-10">
              {t("hj.readJournal")} →
            </Link>
          </div>
        </FadeIn>
        <FadeIn className="order-1 relative aspect-[4/5] overflow-hidden lg:order-2 lg:aspect-auto">
          <Image src="https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=2400&q=80" alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
        </FadeIn>
      </section>

      <section className="page-gutter py-24 md:py-32">
        <div className="mx-auto max-w-[1400px]">
          <h3 className="font-display text-3xl md:text-4xl">{t("hj.selectedPieces")}</h3>
          <div className="mt-12 grid grid-cols-2 gap-x-5 gap-y-14 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-8">
            {hj.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
