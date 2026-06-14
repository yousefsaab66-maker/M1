"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Hero } from "@/components/Hero";
import { ProductCard } from "@/components/ProductCard";
import { SafeImage } from "@/components/SafeImage";
import { FadeIn, SectionTitle } from "@/components/Section";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useStore } from "@/components/providers/StoreProvider";
import {
  atelierImage,
  featuredCollection,
  featuredHomeProducts,
  homeCategoryStripSlugs,
  productCategoryImage,
  productCategoryLabel,
} from "@/lib/site-display";
import { useSiteCopy } from "@/components/hooks/useSiteCopy";
import { prefetchCatalogProductsApi } from "@/lib/catalog-prefetch-client";

function BelowFoldReveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <FadeIn delay={delay} className={className}>
      {children}
    </FadeIn>
  );
}

export default function HomePage() {
  const { t, locale } = useLocale();
  const { products, collections, journal, site } = useStore();
  const tc = useSiteCopy();
  const reduce = useReducedMotion();

  const iconic = useMemo(() => featuredHomeProducts(products, site), [products, site]);
  const featuredCollectionBlock = useMemo(
    () => featuredCollection(collections, site),
    [collections, site],
  );
  const maisonImage = atelierImage(site);
  const categoryStrip = useMemo(() => homeCategoryStripSlugs(site), [site]);

  useEffect(() => {
    prefetchCatalogProductsApi();
  }, []);

  return (
    <div className="flex flex-col">
      <Hero />

      {/* Category strip */}
      <section className="page-gutter py-20 md:py-28">
        <p className="eyebrow text-center">{t("nav.collections")}</p>
        <div className="mx-auto mt-8 grid max-w-[1400px] grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:gap-6">
          {categoryStrip.map((key) => (
              <Link
                key={key}
                href={`/products?category=${key}` as never}
                className="product-image-zoom relative block aspect-[3/4] overflow-hidden"
                style={{ background: "var(--surface-2)" }}
              >
                <Image
                  src={productCategoryImage(key, site)}
                  alt={productCategoryLabel(key, site, t, locale)}
                  fill
                  sizes="(min-width: 768px) 25vw, 50vw"
                  className="object-cover"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, transparent 50%, rgba(10,10,10,0.55) 100%)",
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 text-[var(--color-ivory)]">
                  <h3 className="font-display text-2xl md:text-3xl" style={{ color: "var(--color-ivory)" }}>
                    {productCategoryLabel(key, site, t, locale)}
                  </h3>
                  <ArrowUpRight className="h-5 w-5 opacity-80" strokeWidth={1.3} />
                </div>
              </Link>
          ))}
        </div>
      </section>

      <div className="divider-gold mx-auto my-10 w-[40%]" />

      {/* Featured collection split */}
      {featuredCollectionBlock && (
        <section className="page-gutter py-20 md:py-28">
          <div className="mx-auto grid max-w-[1400px] items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <BelowFoldReveal>
              <div className="product-image-zoom relative aspect-[4/5] overflow-hidden" style={{ background: "var(--surface-2)" }}>
                <SafeImage
                  src={featuredCollectionBlock.editorialImage}
                  alt={featuredCollectionBlock.name}
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
            </BelowFoldReveal>
            <BelowFoldReveal delay={0.15}>
              <div>
                <p className="eyebrow">{t("common.newCollection")}</p>
                <h3 className="font-display mt-5 text-4xl leading-[1.05] md:text-6xl">
                  {featuredCollectionBlock.name}
                </h3>
                <p className="mt-3 text-base italic opacity-75">{featuredCollectionBlock.tagline}</p>
                <p className="mt-7 max-w-md text-base leading-relaxed opacity-85">
                  {featuredCollectionBlock.description}
                </p>
                <div className="mt-10 flex flex-wrap items-center gap-4">
                  <Link href={`/collections/${featuredCollectionBlock.slug}` as never} className="btn-primary">
                    {t("common.explore")}
                  </Link>
                  <Link
                    href={"/collections" as never}
                    className="text-[11px] tracking-eyebrow uppercase gold-underline"
                  >
                    {t("common.viewAll")} →
                  </Link>
                </div>
              </div>
            </BelowFoldReveal>
          </div>
        </section>
      )}

      <div className="divider-gold mx-auto my-10 w-[40%]" />

      {/* Iconic creations */}
      <section className="page-gutter py-20 md:py-28">
        <SectionTitle eyebrow={tc("common.iconic")} title={tc("common.iconic")} subtitle={tc("hero.sub")} />
        <div className="mx-auto mt-16 grid max-w-[1400px] grid-cols-2 gap-x-5 gap-y-14 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-8">
          {iconic.slice(0, 8).map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
        <div className="mt-14 flex justify-center">
          <Link href={"/products" as never} className="btn-ghost">
            {t("common.viewAll")} <ArrowRight className="h-4 w-4" strokeWidth={1.4} />
          </Link>
        </div>
      </section>

      {/* Maison story two column */}
      <section className="page-gutter py-20 md:py-28" style={{ background: "var(--surface)" }}>
        <div className="mx-auto grid max-w-[1400px] items-center gap-14 lg:grid-cols-2 lg:gap-24">
          <BelowFoldReveal>
            <div>
              <p className="eyebrow">{t("common.maison")}</p>
              <h3 className="font-display mt-5 text-4xl leading-[1.05] md:text-5xl">
                {tc("story.title")}
              </h3>
              <p className="mt-7 text-base leading-relaxed opacity-85">
                {tc("story.lede")}
              </p>
              <p className="mt-5 text-base leading-relaxed opacity-75">
                {tc("home.atelier.bodyExtra")}
              </p>
              <div className="mt-10">
                <Link href={"/story" as never} className="btn-primary">
                  {t("common.discover")}
                </Link>
              </div>
            </div>
          </BelowFoldReveal>
          <BelowFoldReveal delay={0.15}>
            <motion.div
              className="relative aspect-[4/5]"
              style={{ background: "var(--surface-2)" }}
              initial={reduce ? false : { y: 30, opacity: 0 }}
              whileInView={reduce ? undefined : { y: 0, opacity: 1 }}
              viewport={{ once: true, margin: "-15% 0px" }}
              transition={{ duration: 1.2, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <Image
                src={maisonImage}
                alt={t("home.atelier.parisCaption")}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.35) 100%)",
                }}
              />
              <p className="absolute bottom-6 start-6 text-[11px] tracking-eyebrow uppercase" style={{ color: "var(--color-ivory)" }}>
                {tc("home.atelier.parisCaption")}
              </p>
            </motion.div>
          </BelowFoldReveal>
        </div>
      </section>

      {/* Journal teaser */}
      <section className="page-gutter py-20 md:py-28">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex items-end justify-between gap-6">
              <div>
                <p className="eyebrow">{t("nav.journal")}</p>
                <h3 className="font-display mt-3 text-3xl md:text-4xl">{tc("home.fromMaison")}</h3>
              </div>
              <Link href={"/journal" as never} className="text-[11px] tracking-eyebrow uppercase gold-underline">
                {t("common.viewAll")} →
              </Link>
            </div>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {journal.slice(0, 3).map((a) => (
                <Link key={a.id} href={`/journal/${a.slug}` as never} className="group block">
                  <div className="product-image-zoom relative aspect-[4/5] overflow-hidden" style={{ background: "var(--surface-2)" }}>
                    <SafeImage src={a.image} alt={a.title} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
                  </div>
                  <p className="mt-5 text-[11px] tracking-eyebrow uppercase opacity-65">
                    {a.category}
                  </p>
                  <h4 className="font-display mt-2 text-2xl gold-underline">{a.title}</h4>
                  <p className="mt-3 text-sm leading-relaxed opacity-75">{a.excerpt}</p>
                </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Boutique teaser map-like */}
      <section
        className="relative overflow-hidden page-gutter py-24 md:py-36"
        style={{ background: "var(--color-onyx)", color: "var(--color-ivory)" }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          aria-hidden
          style={{
            backgroundImage: `radial-gradient(circle at 20% 30%, rgba(184,154,94,0.45), transparent 25%), radial-gradient(circle at 70% 60%, rgba(184,154,94,0.35), transparent 22%), radial-gradient(circle at 45% 80%, rgba(184,154,94,0.4), transparent 25%), radial-gradient(circle at 85% 25%, rgba(184,154,94,0.45), transparent 22%)`,
            backgroundColor: "transparent",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          aria-hidden
          style={{
            backgroundImage:
              "linear-gradient(rgba(246,241,231,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(246,241,231,0.06) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="relative mx-auto max-w-[1400px] text-center">
          <p className="eyebrow" style={{ color: "var(--color-gold)" }}>
            {t("common.boutiques")}
          </p>
          <h3 className="font-display mt-5 text-4xl leading-[1.05] md:text-6xl">
            {tc("home.boutiques.cities")}
          </h3>
          <p className="mx-auto mt-6 max-w-xl opacity-80">{tc("boutiques.sub")}</p>
          <div className="mt-10">
            <Link href={"/boutiques" as never} className="btn-primary" style={{ background: "var(--color-ivory)", color: "var(--color-onyx)", borderColor: "var(--color-ivory)" }}>
              {tc("boutiques.title")}
            </Link>
          </div>
        </div>
      </section>

      {/* Newsletter band */}
      <section className="page-gutter py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <BelowFoldReveal>
            <p className="eyebrow">{t("common.newsletter")}</p>
            <h3 className="font-display mt-5 text-4xl leading-[1.05] md:text-5xl">
              {tc("home.newsletter.title")}
            </h3>
            <p className="mx-auto mt-6 max-w-md text-base opacity-80">
              {tc("common.newsletter.copy")}
            </p>
            <NewsletterForm />
          </BelowFoldReveal>
        </div>
      </section>
    </div>
  );
}

function NewsletterForm() {
  const { t } = useLocale();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const target = e.currentTarget;
        const submit = target.querySelector("button");
        if (submit) submit.textContent = "✓";
      }}
      className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 sm:flex-row"
    >
      <input
        type="email"
        required
        placeholder={t("common.email")}
        aria-label={t("common.email")}
        className="input-luxe flex-1"
      />
      <button type="submit" className="btn-primary">
        {t("common.signup")}
      </button>
    </form>
  );
}
