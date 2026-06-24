"use client";

import Link from "next/link";
import { Heart, Play } from "lucide-react";
import type { Product } from "@/lib/catalog";
import { SafeImage } from "@/components/SafeImage";
import { useStore } from "@/components/providers/StoreProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { ProductPrice } from "@/components/ProductPrice";
import { getProductListingPrice, isProductInStock, isStockTracked, productHasMultiplePrices } from "@/lib/product-prices";
import { productHasVideos, productImageAtForDisplay } from "@/lib/product-media";

interface ProductCardProps {
  product: Product;
  size?: "default" | "tall";
  index?: number;
}

export function ProductCard({ product, size = "default" }: ProductCardProps) {
  const { toggleWish, inWishlist } = useStore();
  const { locale, t } = useLocale();
  const wished = inWishlist(product.id);

  return (
    <article className="group flex flex-col">
      <Link
        href={`/products/${product.slug}` as never}
        className="product-image-zoom relative block overflow-hidden"
        style={{
          aspectRatio: size === "tall" ? "3/4" : "1/1",
          background: "var(--surface-2)",
        }}
      >
        <SafeImage
          src={productImageAtForDisplay(product, 0, "card")}
          alt={product.name}
          fill
          loading="lazy"
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
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
        {product.isNew && (
          <span
            className="absolute start-3 top-3 z-10 px-2 py-1 text-[9px] tracking-eyebrow uppercase"
            style={{ background: "var(--color-ivory)", color: "var(--color-onyx)" }}
          >
            {t("product.new")}
          </span>
        )}
        {isStockTracked(product) && !isProductInStock(product) && (
          <span
            className="absolute bottom-3 start-3 z-10 px-2 py-1 text-[9px] tracking-eyebrow uppercase"
            style={{ background: "var(--color-bordeaux)", color: "var(--color-ivory)" }}
          >
            {t("product.outOfStock")}
          </span>
        )}
      </Link>
      <div className="mt-5 flex flex-col items-center gap-1.5 text-center">
        <Link
          href={`/products/${product.slug}` as never}
          className="font-display text-lg leading-none gold-underline"
        >
          {product.name}
        </Link>
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
