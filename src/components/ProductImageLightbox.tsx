"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { SafeImage } from "@/components/SafeImage";
import { useLocale } from "@/components/providers/LocaleProvider";
import { productImageForDisplay } from "@/lib/product-media";

function useIsBrowser() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !containerRef.current) return;
    const root = containerRef.current;
    const previous = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    const focusFirst = () => {
      const items = focusables();
      items[0]?.focus();
    };

    focusFirst();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    root.addEventListener("keydown", onKeyDown);
    return () => {
      root.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [active, containerRef]);
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export interface ProductImageLightboxProps {
  open: boolean;
  onClose: () => void;
  images: string[];
  index: number;
  onIndexChange: (index: number) => void;
  productName: string;
}

export function ProductImageLightbox({
  open,
  onClose,
  images,
  index,
  onIndexChange,
  productName,
}: ProductImageLightboxProps) {
  const { t } = useLocale();
  const isBrowser = useIsBrowser();
  const reducedMotion = usePrefersReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(MIN_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);

  const resetZoom = useCallback(() => {
    setScale(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
  }, []);

  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    resetZoom();
  }, [open, index, resetZoom]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (images.length <= 1) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onIndexChange((index - 1 + images.length) % images.length);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onIndexChange((index + 1) % images.length);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, images.length, index, onIndexChange]);

  const clampPan = useCallback((nextScale: number, nextPan: { x: number; y: number }) => {
    if (nextScale <= MIN_ZOOM) return { x: 0, y: 0 };
    const vp = viewportRef.current;
    if (!vp) return nextPan;
    const maxX = ((nextScale - 1) * vp.clientWidth) / 2;
    const maxY = ((nextScale - 1) * vp.clientHeight) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, nextPan.x)),
      y: Math.max(-maxY, Math.min(maxY, nextPan.y)),
    };
  }, []);

  const setZoom = useCallback(
    (next: number) => {
      const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
      setScale(clamped);
      setPan((p) => clampPan(clamped, p));
    },
    [clampPan],
  );

  const toggleZoom = () => {
    if (scale > MIN_ZOOM) {
      resetZoom();
    } else {
      setZoom(2.5);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom(scale + delta);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= MIN_ZOOM) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setPan(clampPan(scale, { x: dragRef.current.panX + dx, y: dragRef.current.panY + dy }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    dragRef.current = null;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 2) return;
    const [a, b] = [e.touches[0], e.touches[1]];
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    pinchRef.current = { dist, scale };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 2 || !pinchRef.current) return;
    e.preventDefault();
    const [a, b] = [e.touches[0], e.touches[1]];
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const ratio = dist / pinchRef.current.dist;
    setZoom(pinchRef.current.scale * ratio);
  };

  const onTouchEnd = () => {
    pinchRef.current = null;
  };

  if (!isBrowser) return null;

  const rawSrc = images[index] ?? images[0];
  const src = productImageForDisplay(rawSrc, "zoom");
  const hasMultiple = images.length > 1;
  const motionDuration = reducedMotion ? 0 : 0.35;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={t("product.lightboxAria")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: motionDuration, ease: [0.22, 0.61, 0.36, 1] }}
          className="fixed inset-0 z-[80] flex flex-col"
        >
          <div
            className="absolute inset-0 bg-black/88 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden
          />

          <div className="relative z-10 flex shrink-0 items-center justify-between px-4 py-4 sm:px-6">
            <p className="eyebrow text-[var(--color-ivory)] opacity-70">
              {productName}
              {hasMultiple && (
                <span className="ms-3 opacity-60">
                  {index + 1} / {images.length}
                </span>
              )}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setZoom(scale - 0.5)}
                disabled={scale <= MIN_ZOOM}
                className="flex h-11 w-11 items-center justify-center text-[var(--color-ivory)] transition-opacity hover:opacity-80 disabled:opacity-30"
                aria-label={t("product.lightboxZoomOut")}
              >
                <ZoomOut className="h-5 w-5" strokeWidth={1.4} />
              </button>
              <button
                type="button"
                onClick={() => setZoom(scale + 0.5)}
                disabled={scale >= MAX_ZOOM}
                className="flex h-11 w-11 items-center justify-center text-[var(--color-ivory)] transition-opacity hover:opacity-80 disabled:opacity-30"
                aria-label={t("product.lightboxZoomIn")}
              >
                <ZoomIn className="h-5 w-5" strokeWidth={1.4} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center text-[var(--color-ivory)] transition-opacity hover:opacity-80"
                aria-label={t("common.close")}
              >
                <X className="h-5 w-5" strokeWidth={1.4} />
              </button>
            </div>
          </div>

          <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 pb-6 sm:px-10">
            {hasMultiple && (
              <button
                type="button"
                onClick={() => onIndexChange((index - 1 + images.length) % images.length)}
                className="absolute start-2 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center text-[var(--color-ivory)] transition-opacity hover:opacity-80 sm:start-4"
                aria-label={t("product.lightboxPrev")}
              >
                <ChevronLeft className="h-7 w-7" strokeWidth={1.2} />
              </button>
            )}

            <div
              ref={viewportRef}
              className="relative h-full max-h-[min(78dvh,900px)] w-full max-w-[min(96%,1100px)] overflow-hidden"
              onWheel={onWheel}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <button
                type="button"
                onClick={toggleZoom}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="relative h-full w-full cursor-zoom-in focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-gold)]"
                style={{ cursor: scale > MIN_ZOOM ? "grab" : "zoom-in" }}
                aria-label={
                  scale > MIN_ZOOM ? t("product.lightboxZoomOut") : t("product.lightboxZoomIn")
                }
              >
                <motion.div
                  key={src}
                  initial={reducedMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1, scale, x: pan.x, y: pan.y }}
                  transition={{ duration: reducedMotion ? 0 : 0.4, ease: [0.22, 0.61, 0.36, 1] }}
                  className="relative h-full w-full"
                >
                  <SafeImage
                    src={src}
                    alt={`${productName} — ${t("product.imageAlt")} ${index + 1}`}
                    fill
                    sizes="100vw"
                    priority
                    className="object-contain select-none"
                    draggable={false}
                  />
                </motion.div>
              </button>
            </div>

            {hasMultiple && (
              <button
                type="button"
                onClick={() => onIndexChange((index + 1) % images.length)}
                className="absolute end-2 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center text-[var(--color-ivory)] transition-opacity hover:opacity-80 sm:end-4"
                aria-label={t("product.lightboxNext")}
              >
                <ChevronRight className="h-7 w-7" strokeWidth={1.2} />
              </button>
            )}
          </div>

          {hasMultiple && (
            <div className="relative z-10 flex shrink-0 justify-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {images.map((thumb, i) => (
                <button
                  key={thumb + i}
                  type="button"
                  onClick={() => onIndexChange(i)}
                  aria-label={`${t("product.imageAlt")} ${i + 1}`}
                  aria-current={i === index ? "true" : undefined}
                  className="relative h-14 w-14 overflow-hidden sm:h-16 sm:w-16"
                  style={{
                    border:
                      i === index
                        ? "1px solid var(--color-gold)"
                        : "1px solid color-mix(in srgb, var(--color-ivory) 25%, transparent)",
                    opacity: i === index ? 1 : 0.55,
                  }}
                >
                  <SafeImage
                    src={productImageForDisplay(thumb, "thumb")}
                    alt=""
                    fill
                    loading="lazy"
                    sizes="64px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
