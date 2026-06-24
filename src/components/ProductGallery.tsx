"use client";

import { useEffect, useState } from "react";
import { Maximize2 } from "lucide-react";
import { SafeImage } from "@/components/SafeImage";
import { ProductImageLightbox } from "@/components/ProductImageLightbox";
import { SoldOutBadge } from "@/components/SoldOutBadge";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  productImageAt,
  productImageForDisplay,
  productVideoSources,
} from "@/lib/product-media";
import { isProductSoldOut } from "@/lib/product-stock";
import type { Product } from "@/lib/catalog";

interface ProductGalleryProps {
  product: Product;
  images: string[];
}

export function ProductGallery({ product, images }: ProductGalleryProps) {
  const { t } = useLocale();
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [hiResReady, setHiResReady] = useState(false);
  const videos = productVideoSources(product);
  const soldOut = isProductSoldOut(product);

  const mainRaw = productImageAt(product, active);
  const mainPreview = productImageForDisplay(mainRaw, "card");
  const mainHiRes = productImageForDisplay(mainRaw, "pdp");

  useEffect(() => {
    setHiResReady(false);
    if (mainPreview === mainHiRes) {
      setHiResReady(true);
      return;
    }
    const img = new window.Image();
    img.src = mainHiRes;
    img.onload = () => setHiResReady(true);
    return () => {
      img.onload = null;
    };
  }, [mainHiRes, mainPreview]);

  const openLightbox = (index: number) => {
    setActive(index);
    setLightboxOpen(true);
  };

  return (
    <>
      <div>
        <button
          type="button"
          onClick={() => openLightbox(active)}
          className="product-image-zoom group relative block w-full overflow-hidden focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-gold)]"
          style={{ aspectRatio: "4/5", background: "var(--surface-2)" }}
          aria-label={t("product.lightboxOpen")}
        >
          <SafeImage
            key={mainRaw}
            src={hiResReady ? mainHiRes : mainPreview}
            alt={product.name}
            fill
            priority
            sizes="(min-width: 1024px) 60vw, 100vw"
            className={`object-cover${soldOut ? " grayscale opacity-55" : ""}`}
          />
          {soldOut && <SoldOutBadge />}
          <span
            className="pointer-events-none absolute inset-0 flex items-end justify-end p-4 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100"
            aria-hidden
          >
            <span
              className="flex h-10 w-10 items-center justify-center backdrop-blur-sm"
              style={{
                background: "color-mix(in srgb, var(--color-onyx) 55%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-gold) 45%, transparent)",
                color: "var(--color-ivory)",
              }}
            >
              <Maximize2 className="h-4 w-4" strokeWidth={1.4} />
            </span>
          </span>
        </button>

        {images.length > 1 && (
          <div className="mt-4 grid grid-cols-4 gap-3">
            {images.map((src, i) => (
              <button
                key={src + i}
                type="button"
                aria-label={`${t("product.imageAlt")} ${i + 1}`}
                aria-current={i === active ? "true" : undefined}
                onClick={() => openLightbox(i)}
                className="relative aspect-square overflow-hidden focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-gold)]"
                style={{
                  border: i === active ? "1px solid var(--color-gold)" : "1px solid var(--line)",
                  background: "var(--surface-2)",
                }}
              >
                <SafeImage
                  src={productImageForDisplay(src, "thumb")}
                  alt=""
                  fill
                  loading="lazy"
                  sizes="120px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {videos.length > 0 && (
          <div className="mt-8 space-y-4">
            <p className="eyebrow opacity-75">{t("product.videosTitle")}</p>
            {videos.map((src, i) => (
              <video
                key={src + i}
                controls
                playsInline
                preload="metadata"
                className="w-full"
                style={{ aspectRatio: "16/9", background: "var(--surface-2)" }}
                aria-label={`${t("product.videoAlt")} ${i + 1}`}
              >
                <source src={src} />
              </video>
            ))}
          </div>
        )}
      </div>

      <ProductImageLightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={images}
        index={active}
        onIndexChange={setActive}
        productName={product.name}
      />
    </>
  );
}
