"use client";

import Link from "next/link";
import { Heart, Play } from "lucide-react";
import type { Product } from "@/lib/catalog";
import { SafeImage } from "@/components/SafeImage";
import { useStore } from "@/components/providers/StoreProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { ProductPrice } from "@/components/ProductPrice";
import { getProductListingPrice, productHasMultiplePrices } from "@/lib/product-prices";
import { hasPartialSlotAvailability, isProductSoldOut } from "@/lib/product-stock";
import { productHasVideos, productImageAtForDisplay } from "@/lib/product-media";
import { SoldOutBadge } from "@/components/SoldOutBadge";

interface ProductCardProps {
  product: Product;
  size?: "default" | "tall";
  index?: number;
}

export function ProductCard({ product, size = "default" }: ProductCardProps) {
  const { toggleWish, inWishlist } = useStore();
  const { locale, t } = useLocale();
  const wished = inWishlist(product.id);
  const soldOut = isProductSoldOut(product);
  const partialAvailability = !soldOut && hasPartialSlotAvailability(product);

  return (
    <article className={`group flex flex-col${soldOut ? " opacity-90" : ""}`}>
      <Link
        href={`/products/${product.slug}` as never}
        className="product-image-zoom relative block overflow-hidden"
        style={{
          aspectRatio: size === "tall" ? "3/4" : "1/1",
          background: "var(--surface-2)",
        }}
        aria-label={soldOut ? `${product.name} — ${t("product.soldOutBadge")}` : product.name}
      >
        <SafeImage
          src={productImageAtForDisplay(product, 0, "card")}
          alt={product.name}
          fill
          loading="lazy"
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className={`object-cover transition-[filter,opacity] duration-500${soldOut ? " grayscale opacity-55" : ""}`}
        />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            toggleWish(product.id);
          }}
          aria-pressed={wished}
          aria-label={wished ? t("common.removeWish") : t("common.addWish")}
          className="absolute end-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition-opacity"
          style={{
            background: "color-mix(in srgb, var(--background) 78%, transparent)",
            border: "1px solid var(--line)",
          }}
        >
          <Heart
            className="h-4 w-4"
            strokeWidth={1.4}
            fill={wished ? "currentColor" : "none"}
            color={wished ? "var(--color-bordeaux)" : "currentColor"}
          />
        </button>
        {productHasVideos(product) && (
          <span
            className="absolute bottom-3 end-3 z-10 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur"
            style={{
              background: "color-mix(in srgb, var(--color-onyx) 55%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-gold) 45%, transparent)",
              color: "var(--color-ivory)",
            }}
            aria-hidden
          >
            <Play className="h-4 w-4" strokeWidth={1.4} fill="currentColor" />
          </span>
        )}
        {product.isNew && !soldOut && (
          <span
            className="absolute start-3 top-3 z-10 px-2 py-1 text-[9px] tracking-eyebrow uppercase"
            style={{ background: "var(--color-ivory)", color: "var(--color-onyx)" }}
          >
            {t("product.new")}
          </span>
        )}
        {soldOut && <SoldOutBadge />}
      </Link>
      <div className="mt-5 flex flex-col items-center gap-1.5 text-center">
        <Link
          href={`/products/${product.slug}` as never}
          className={`font-display text-lg leading-none gold-underline${soldOut ? " opacity-60" : ""}`}
        >
          {product.name}
        </Link>
        {soldOut && (
          <p className="text-[10px] uppercase tracking-eyebrow text-[var(--color-bordeaux)]">
            {t("product.outOfStock")}
          </p>
        )}
        {partialAvailability && (
          <p className="text-[10px] uppercase tracking-eyebrow opacity-70">
            {t("product.partialAvailability")}
          </p>
        )}
        <p className="text-[11px] tracking-eyebrow uppercase opacity-65">{product.collection.replace("muhra-", "")}</p>
        {productHasMultiplePrices(product) ? (
          <p className="mt-1 text-sm opacity-85">
            <span className="text-[10px] uppercase tracking-eyebrow opacity-70">{t("product.priceFrom")} </span>
            <ProductPrice amount={getProductListingPrice(product)} currency={product.currency} size="sm" className="!inline" />
          </p>
        ) : (
          <ProductPrice amount={getProductListingPrice(product)} currency={product.currency} size="sm" className="mt-1" />
        )}
      </div>
    </article>
  );
}
