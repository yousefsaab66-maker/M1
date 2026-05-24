"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import type { Product } from "@/lib/catalog";
import { SafeImage } from "@/components/SafeImage";
import { useStore } from "@/components/providers/StoreProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { ProductPrice } from "@/components/ProductPrice";
import { productImageAt } from "@/lib/product-media";

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
          src={productImageAt(product, 0)}
          alt={product.name}
          fill
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
        {product.isNew && (
          <span
            className="absolute start-3 top-3 z-10 px-2 py-1 text-[9px] tracking-eyebrow uppercase"
            style={{ background: "var(--color-ivory)", color: "var(--color-onyx)" }}
          >
            {t("product.new")}
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
        <ProductPrice amount={product.price} currency={product.currency} size="sm" className="mt-1" />
      </div>
    </article>
  );
}
