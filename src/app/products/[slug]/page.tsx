"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Heart, Plus, Minus } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { ProductGallery } from "@/components/ProductGallery";
import { useStore } from "@/components/providers/StoreProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useSiteCopy } from "@/components/hooks/useSiteCopy";
import { ProductPrice } from "@/components/ProductPrice";
import { SoldOutBadge } from "@/components/SoldOutBadge";
import { findProductBySlug, productGallerySources } from "@/lib/product-media";
import {
  getActivePriceSlots,
  isProductInStock,
  isProductSoldOut,
  isStockTracked,
  priceSlotLabel,
  requiresPriceSelection,
  resolveProductUnitPrice,
} from "@/lib/product-prices";
import {
  bagLineKey,
  bagLineSizeKey,
  getProductSizeGroups,
  isSizeSelectionsComplete,
  formatSizeDisplayValue,
  sizeKindLabelKey,
  type ProductSizeKind,
  type ProductSizeSelections,
} from "@/lib/product-sizes";
import { maxQtyForBagLine } from "@/lib/product-stock";
import { CUSTOMER_NOTE_MAX_LENGTH, normalizeCustomerNote } from "@/lib/customer-note";
import type { Product } from "@/lib/catalog";
import { productCategoryLabel } from "@/lib/site-display";

export default function ProductPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const { products, mergeRemoteProduct } = useStore();
  const { t } = useLocale();

  const product = useMemo(() => findProductBySlug(products, slug), [products, slug]);
  const [slugLoading, setSlugLoading] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const ac = new AbortController();
    const needsFetch =
      !product || !product.description.trim() || !product.story.trim();
    if (!needsFetch) return () => ac.abort();

    setSlugLoading(!product);
    void fetch(`/api/catalog/products?slug=${encodeURIComponent(slug)}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { product?: Product } | null) => {
        if (d?.product) mergeRemoteProduct(d.product);
      })
      .catch(() => {})
      .finally(() => setSlugLoading(false));
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

  if (!product) {
    if (slugLoading) {
      return (
        <div className="px-6 py-32 text-center">
          <p className="eyebrow opacity-70">{t("product.loading")}</p>
        </div>
      );
    }
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
        <div className="mx-auto grid min-w-0 max-w-[1500px] gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
          <ProductGallery product={product} images={gallery} />

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
  const { bag, addToBag, toggleWish, inWishlist, site } = useStore();

  const sizeGroups = useMemo(
    () => getProductSizeGroups(product, site),
    [product, site],
  );
  const hasSizes = sizeGroups.length > 0;
  const multiGroup = sizeGroups.length > 1;

  const [size, setSize] = useState<string | undefined>(() => {
    if (sizeGroups.length !== 1) return undefined;
    const only = sizeGroups[0]!.sizes;
    return only.length === 1 ? only[0] : undefined;
  });
  const [sizeSelections, setSizeSelections] = useState<ProductSizeSelections>({});
  const [qty, setQty] = useState(1);
  const [customerNote, setCustomerNote] = useState("");
  const [added, setAdded] = useState(false);
  const [sizeError, setSizeError] = useState(false);
  const [priceError, setPriceError] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const wished = inWishlist(product.id);
  const inStock = isProductInStock(product);
  const soldOut = isProductSoldOut(product);
  const activePrices = useMemo(() => getActivePriceSlots(product), [product]);
  const needsPricePick = requiresPriceSelection(product);
  const [priceSlotIndex, setPriceSlotIndex] = useState<number | undefined>(() => {
    const slots = getActivePriceSlots(product);
    return slots.length === 1 ? slots[0]!.index : undefined;
  });
  const displayPrice = resolveProductUnitPrice(product, priceSlotIndex);

  const lineKey = useMemo(
    () => bagLineSizeKey({ size, sizeSelections, priceSlotIndex }),
    [size, sizeSelections, priceSlotIndex],
  );
  const maxQty = useMemo(
    () => maxQtyForBagLine(product, bag, lineKey),
    [product, bag, lineKey],
  );
  const canAddMore = inStock && (maxQty == null || maxQty > 0);

  const onAdd = () => {
    setStockError(null);
    if (!inStock) return;
    const note = normalizeCustomerNote(customerNote);
    if (needsPricePick && priceSlotIndex == null) {
      setPriceError(true);
      return;
    }
    if (hasSizes) {
      if (multiGroup) {
        if (!isSizeSelectionsComplete(sizeGroups, sizeSelections)) {
          setSizeError(true);
          return;
        }
        setSizeError(false);
        const result = addToBag({
          productId: product.id,
          sizeSelections,
          qty,
          priceSlotIndex,
          customerNote: note,
        });
        if (!result.ok) {
          setStockError(
            result.error === "out_of_stock"
              ? t("product.outOfStock")
              : t("product.stockOnlyAvailable").replace("{n}", String(result.available ?? 0)),
          );
          return;
        }
      } else {
        if (!size) {
          setSizeError(true);
          return;
        }
        setSizeError(false);
        const result = addToBag({
          productId: product.id,
          size,
          qty,
          priceSlotIndex,
          customerNote: note,
        });
        if (!result.ok) {
          setStockError(
            result.error === "out_of_stock"
              ? t("product.outOfStock")
              : t("product.stockOnlyAvailable").replace("{n}", String(result.available ?? 0)),
          );
          return;
        }
      }
    } else {
      setSizeError(false);
      const result = addToBag({ productId: product.id, qty, priceSlotIndex, customerNote: note });
      if (!result.ok) {
        setStockError(
          result.error === "out_of_stock"
            ? t("product.outOfStock")
            : t("product.stockOnlyAvailable").replace("{n}", String(result.available ?? 0)),
        );
        return;
      }
    }
    setPriceError(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  };

  const selectGroupSize = (kind: ProductSizeKind, value: string) => {
    setSizeSelections((prev) => ({ ...prev, [kind]: value }));
    setSizeError(false);
  };

  return (
    <>
      <p className="eyebrow">{product.collection.replace("muhra-", "MUHRA ")}</p>
      <h1 className="font-display mt-4 text-4xl leading-[1.05] md:text-5xl">{product.name}</h1>
      <p className="mt-3 italic opacity-75">{product.description}</p>
      {soldOut && (
        <div className="mt-6">
          <SoldOutBadge variant="banner" />
        </div>
      )}
      {isStockTracked(product) && inStock && (
        <p className="mt-4 text-[11px] uppercase tracking-eyebrow opacity-75">
          {product.stock != null && product.stock > 0
            ? t("product.stockQty").replace("{n}", String(product.stock))
            : t("product.inStock")}
        </p>
      )}
      {activePrices.length > 1 ? (
        <div className="mt-7 space-y-3">
          <p className="eyebrow opacity-80">{t("product.priceOptionsTitle")}</p>
          <div className="flex flex-wrap gap-2">
            {activePrices.map((slot) => {
              const active = priceSlotIndex === slot.index;
              return (
                <button
                  key={slot.index}
                  type="button"
                  onClick={() => {
                    setPriceSlotIndex(slot.index);
                    setPriceError(false);
                  }}
                  aria-pressed={active}
                  className="size-chip"
                  data-active={active}
                >
                  <span className="block text-[10px] opacity-75">{priceSlotLabel(slot, t)}</span>
                  <ProductPrice amount={slot.amount} currency={product.currency} size="sm" className="!mt-0" align="center" />
                </button>
              );
            })}
          </div>
          {priceError && (
            <p className="text-sm text-[var(--color-bordeaux)]" role="alert">
              {t("product.priceRequired")}
            </p>
          )}
        </div>
      ) : (
        <ProductPrice amount={displayPrice} currency={product.currency} size="lg" className="mt-7" />
      )}

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
        <dd>{productCategoryLabel(product.category, site, t, locale)}</dd>
      </dl>

      {hasSizes && (
        <div className="mt-8 space-y-6">
          {sizeGroups.map((group) => (
            <div key={group.kind}>
              <p className="eyebrow mb-3">
                {multiGroup ? t(sizeKindLabelKey(group.kind)) : t("common.size")}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.sizes.map((s) => {
                  const active = multiGroup ? sizeSelections[group.kind] === s : size === s;
                  return (
                    <button
                      key={`${group.kind}-${s}`}
                      type="button"
                      onClick={() => {
                        if (multiGroup) selectGroupSize(group.kind, s);
                        else {
                          setSize(s);
                          setSizeError(false);
                        }
                      }}
                      aria-pressed={active}
                      className="size-chip"
                      data-active={active}
                    >
                      {formatSizeDisplayValue(group.kind, s)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {sizeError && (
            <p className="text-sm text-[var(--color-bordeaux)]" role="alert">
              {multiGroup ? t("product.sizesRequired") : t("product.sizeRequired")}
            </p>
          )}
        </div>
      )}

      <div className="mt-8 flex items-center gap-4">
        <p className="eyebrow opacity-80">{t("common.qty")}</p>
        <div
          className={`flex items-center${soldOut ? " opacity-40 pointer-events-none" : ""}`}
          style={{ border: "1px solid var(--line-strong)" }}
        >
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
            onClick={() => setQty((q) => (maxQty == null ? q + 1 : Math.min(maxQty, q + 1)))}
            disabled={maxQty != null && (maxQty === 0 || qty >= maxQty)}
            className="px-3 py-2 disabled:opacity-40"
            aria-label={t("bag.qtyIncrease")}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="mt-8">
        <label className="eyebrow block opacity-80" htmlFor={`note-${product.id}`}>
          {t("product.customerNote.label")}
        </label>
        <textarea
          id={`note-${product.id}`}
          className="input-luxe mt-3 min-h-[88px] w-full resize-y text-sm"
          value={customerNote}
          onChange={(e) => setCustomerNote(e.target.value.slice(0, CUSTOMER_NOTE_MAX_LENGTH))}
          placeholder={t("product.customerNote.placeholder")}
          maxLength={CUSTOMER_NOTE_MAX_LENGTH}
          rows={3}
        />
        <p className="mt-2 text-[11px] opacity-60">{t("product.customerNote.hint")}</p>
      </div>

      {stockError && (
        <p className="mt-3 text-sm text-[var(--color-bordeaux)]" role="alert">
          {stockError}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAddMore}
          aria-disabled={!canAddMore}
          className="btn-primary flex-1 min-w-[220px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {soldOut || maxQty === 0 ? t("product.outOfStock") : added ? t("common.added") : t("common.add")}
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
