"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Heart, Plus, Minus } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { SafeImage } from "@/components/SafeImage";
import { useStore } from "@/components/providers/StoreProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useSiteCopy } from "@/components/hooks/useSiteCopy";
import { ProductPrice } from "@/components/ProductPrice";
import { productGallerySources, productImageAt } from "@/lib/product-media";
import type { Product } from "@/lib/catalog";

export default function ProductPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const { products, mergeRemoteProduct } = useStore();
  const { t } = useLocale();

  const product = useMemo(() => products.find((p) => p.slug === slug), [products, slug]);

  useEffect(() => {
    if (!slug || !product) return;
    if (product.description.trim() && product.story.trim()) return;
    const ac = new AbortController();
    void fetch(`/api/catalog/products?slug=${encodeURIComponent(slug)}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { product?: Product } | null) => {
        if (d?.product) mergeRemoteProduct(d.product);
      })
      .catch(() => {});
    return () => ac.abort();
  }, [slug, product, mergeRemoteProduct]);
  const related = useMemo(() => {
    if (!product) return [];
    if (product.related && product.related.length > 0) {
      return product.related
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p));
    }
    return products.filter((p) => p.id !== product.id && p.category === product.category).slice(0, 4);
  }, [products, product]);

  const gallery = useMemo(() => (product ? productGallerySources(product) : []), [product]);
  const [active, setActive] = useState(0);

  if (!product) {
    return (
      <div className="px-6 py-32 text-center">
        <p className="font-display text-3xl">{t("product.notFound")}</p>
        <Link href={"/products" as never} className="btn-ghost mt-8">
          {t("common.viewAll")} →
        </Link>
      </div>
    );
  }

  return (
    <article key={product.id}>
      <section className="page-gutter py-12 md:py-16">
        <div className="mx-auto grid max-w-[1500px] gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
          <div>
            <div
              className="product-image-zoom relative overflow-hidden"
              style={{ aspectRatio: "4/5", background: "var(--surface-2)" }}
            >
              <SafeImage
                key={productImageAt(product, active)}
                src={productImageAt(product, active)}
                alt={product.name}
                fill
                priority
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="mt-4 grid grid-cols-4 gap-3">
              {gallery.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  aria-label={`${t("product.imageAlt")} ${i + 1}`}
                  onClick={() => setActive(i)}
                  className="relative aspect-square overflow-hidden"
                  style={{
                    border: i === active ? "1px solid var(--color-gold)" : "1px solid var(--line)",
                    background: "var(--surface-2)",
                  }}
                >
                  <SafeImage src={src} alt="" fill sizes="120px" className="object-cover" />
                </button>
              ))}
            </div>
          </div>

          <div className="lg:sticky lg:top-28 self-start">
            <ProductBuyColumn key={product.id} product={product} />
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="page-gutter py-20 md:py-28" style={{ background: "var(--surface)" }}>
          <div className="mx-auto max-w-[1400px]">
            <h3 className="font-display text-3xl md:text-4xl">{t("common.relatedTitle")}</h3>
            <div className="mt-12 grid grid-cols-2 gap-x-5 gap-y-14 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-8">
              {related.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      <style jsx global>{`
        .size-chip {
          padding: 0.45rem 0.85rem;
          font-size: 0.7rem;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          border: 1px solid var(--line-strong);
          background: transparent;
          transition: background 0.35s var(--ease-luxe), color 0.35s var(--ease-luxe), border-color 0.35s var(--ease-luxe);
        }
        .size-chip:hover {
          border-color: var(--color-gold);
        }
        .size-chip[data-active="true"] {
          background: var(--color-onyx);
          color: var(--color-ivory);
          border-color: var(--color-onyx);
        }
        [data-theme="dark"] .size-chip[data-active="true"] {
          background: var(--color-ivory);
          color: var(--color-onyx);
          border-color: var(--color-ivory);
        }
      `}</style>
    </article>
  );
}

function ProductBuyColumn({ product }: { product: Product }) {
  const { t, locale } = useLocale();
  const tc = useSiteCopy();
  const router = useRouter();
  const { addToBag, toggleWish, inWishlist } = useStore();

  const sizesList = useMemo(
    () => [...new Set((product.sizes ?? []).map((s) => s.trim()).filter(Boolean))],
    [product.sizes],
  );

  const [size, setSize] = useState<string | undefined>(() =>
    sizesList.length === 1 ? sizesList[0] : undefined,
  );
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [sizeError, setSizeError] = useState(false);
  const wished = inWishlist(product.id);

  const onAdd = () => {
    if (sizesList.length > 0) {
      if (!size) {
        setSizeError(true);
        return;
      }
      setSizeError(false);
      addToBag({ productId: product.id, size, qty });
    } else {
      setSizeError(false);
      addToBag({ productId: product.id, qty });
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  };

  return (
    <>
      <p className="eyebrow">{product.collection.replace("muhra-", "MUHRA ")}</p>
      <h1 className="font-display mt-4 text-4xl leading-[1.05] md:text-5xl">{product.name}</h1>
      <p className="mt-3 italic opacity-75">{product.description}</p>
      <ProductPrice amount={product.price} currency={product.currency} size="lg" className="mt-7" />

      <dl className="mt-8 grid grid-cols-2 gap-y-3 text-sm">
        <dt className="eyebrow opacity-65">{t("common.materials")}</dt>
        <dd>{product.materials.map((m) => t(`material.${m}`)).join(", ")}</dd>
        <dt className="eyebrow opacity-65">{t("common.stones")}</dt>
        <dd>
          {product.stones.includes("none")
            ? t("stone.none")
            : product.stones.map((s) => t(`stone.${s}`)).join(", ")}
        </dd>
        <dt className="eyebrow opacity-65">{t("filter.category")}</dt>
        <dd>{t(`category.${product.category}`)}</dd>
      </dl>

      {sizesList.length > 0 && (
        <div className="mt-8">
          <p className="eyebrow mb-3">{t("common.size")}</p>
          <div className="flex flex-wrap gap-2">
            {sizesList.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSize(s);
                  setSizeError(false);
                }}
                aria-pressed={size === s}
                className="size-chip"
                data-active={size === s}
              >
                {s}
              </button>
            ))}
          </div>
          {sizeError && (
            <p className="mt-3 text-sm text-[var(--color-bordeaux)]" role="alert">
              {t("product.sizeRequired")}
            </p>
          )}
        </div>
      )}

      <div className="mt-8 flex items-center gap-4">
        <p className="eyebrow opacity-80">{t("common.qty")}</p>
        <div className="flex items-center" style={{ border: "1px solid var(--line-strong)" }}>
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="px-3 py-2"
            aria-label={t("bag.qtyDecrease")}
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          <span className="px-4 py-2 text-sm">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            className="px-3 py-2"
            aria-label={t("bag.qtyIncrease")}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button type="button" onClick={onAdd} className="btn-primary flex-1 min-w-[220px]">
          {added ? t("common.added") : t("common.add")}
        </button>
        <button
          type="button"
          onClick={() => toggleWish(product.id)}
          aria-pressed={wished}
          className="btn-ghost"
        >
          <Heart className="h-4 w-4" strokeWidth={1.4} fill={wished ? "currentColor" : "none"} />
          {wished ? t("common.removeWish") : t("common.addWish")}
        </button>
      </div>

      <div className="mt-12">
        <Accordion title={t("common.story")} defaultOpen>
          <p className="leading-relaxed opacity-85">{product.story}</p>
        </Accordion>
        <Accordion title={t("common.care")}>
          <p className="leading-relaxed opacity-80">{t("product.care.body")}</p>
        </Accordion>
        <Accordion title={tc("common.returns")}>
          <p className="leading-relaxed opacity-80">{tc("product.returns.body")}</p>
        </Accordion>
      </div>

      <button
        type="button"
        onClick={() => router.back()}
        className="mt-10 text-[11px] tracking-eyebrow uppercase opacity-70 gold-underline"
      >
        ← {t("common.viewAll")}
      </button>
    </>
  );
}

function Accordion({
  title,
  children,
  defaultOpen,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border-t" style={{ borderColor: "var(--line)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-5"
        aria-expanded={open}
      >
        <span className="font-display text-xl">{title}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-500 ${open ? "rotate-180" : ""}`}
          strokeWidth={1.4}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-6 text-sm">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
