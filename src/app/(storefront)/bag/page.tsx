"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, X } from "lucide-react";
import { SectionTitle } from "@/components/Section";
import { SafeImage } from "@/components/SafeImage";
import { productImageForDisplay } from "@/lib/product-media";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useStore, type BagItem } from "@/components/providers/StoreProvider";
import { ProductPrice } from "@/components/ProductPrice";
import { getCustomerPriceParts } from "@/lib/customer-price";
import { resolveProductUnitPrice } from "@/lib/product-prices";
import { maxQtyForBagLine, validateBagStock } from "@/lib/product-stock";
import { bagLineSizeKey, formatBagItemSizeDisplay } from "@/lib/product-sizes";
import { CUSTOMER_NOTE_MAX_LENGTH } from "@/lib/customer-note";
import { getUsdIqdRate } from "@/lib/site-display";

function BagLineNoteEditor({
  value,
  lineId,
  label,
  placeholder,
  maxLength,
  onCommit,
}: {
  value?: string;
  lineId: string;
  label: string;
  placeholder: string;
  maxLength: number;
  onCommit: (note: string) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);
  return (
    <div className="mt-3">
      <label className="text-[10px] tracking-eyebrow uppercase opacity-65" htmlFor={lineId}>
        {label}
      </label>
      <textarea
        id={lineId}
        className="input-luxe mt-1.5 min-h-[72px] w-full resize-y text-sm"
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, maxLength))}
        onBlur={() => onCommit(draft)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={2}
      />
    </div>
  );
}

export default function BagPage() {
  const { bag, products, setBagQty, setBagNote, removeFromBag, hydrated, site, refreshCatalog } = useStore();
  const { t, locale } = useLocale();
  const router = useRouter();
  const items = bag
    .map((b) => ({ b, p: products.find((p) => p.id === b.productId) }))
    .filter((x): x is { b: BagItem; p: NonNullable<typeof x.p> } => Boolean(x.p));
  const subtotal = items.reduce(
    (s, { b, p }) => s + resolveProductUnitPrice(p, b.priceSlotIndex) * b.qty,
    0,
  );
  const currency = items[0]?.p.currency ?? "EUR";
  const usdIqdRate = getUsdIqdRate(site);
  const rateOpts = { usdIqdRate };
  const subtotalDisplay = getCustomerPriceParts(subtotal, currency, locale, rateOpts);
  const stockCheck = useMemo(() => validateBagStock(bag, products), [bag, products]);
  const hasStockIssues = !stockCheck.ok;

  useEffect(() => {
    if (!hydrated || bag.length === 0) return;
    void refreshCatalog();
  }, [hydrated, bag.length, refreshCatalog]);

  const onCheckout = () => {
    if (hasStockIssues) return;
    router.push("/checkout" as never);
  };

  return (
    <div className="page-gutter py-20 md:py-28">
      <SectionTitle eyebrow={t("nav.bag")} title={t("bag.title")} />
      <div className="mx-auto mt-16 max-w-[1300px]">
        {!hydrated ? (
          <div className="py-20 text-center opacity-60">…</div>
        ) : items.length === 0 ? (
          <div className="mx-auto max-w-md text-center py-12">
            <p className="opacity-80">{t("common.empty")}</p>
            <Link href={"/products" as never} className="btn-ghost mt-8 inline-flex">
              {t("common.viewAll")} →
            </Link>
          </div>
        ) : (
          <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr] lg:gap-16">
            <ul className="flex flex-col" aria-live="polite">
              {items.map(({ b, p }, idx) => {
                const sizeLabel = formatBagItemSizeDisplay(b, t);
                const sizeKey = bagLineSizeKey(b);
                const maxLineQty = maxQtyForBagLine(p, bag, sizeKey);
                const atMax = maxLineQty != null && b.qty >= maxLineQty;
                return (
                <li
                  key={`${idx}-${p.id}-${sizeKey}`}
                  className="grid grid-cols-[110px_1fr_auto] items-start gap-5 py-6"
                  style={{ borderTop: "1px solid var(--line)" }}
                >
                  <Link
                    href={`/products/${p.slug}` as never}
                    className="relative aspect-square overflow-hidden"
                    style={{ background: "var(--surface-2)" }}
                  >
                    {p.images[0] && (
                      <SafeImage
                        src={productImageForDisplay(p.images[0], "thumb")}
                        alt={p.name}
                        fill
                        loading="lazy"
                        sizes="120px"
                        className="object-cover"
                      />
                    )}
                  </Link>
                  <div className="min-w-0">
                    <Link
                      href={`/products/${p.slug}` as never}
                      className="font-display text-xl gold-underline"
                    >
                      {p.name}
                    </Link>
                    <p className="mt-1 text-[11px] tracking-eyebrow uppercase opacity-65">
                      {p.collection.replace("muhra-", "")}
                    </p>
                    {sizeLabel && (
                      <p className="mt-1 text-[11px] tracking-eyebrow uppercase opacity-65">
                        {sizeLabel}
                      </p>
                    )}
                    <BagLineNoteEditor
                      value={b.customerNote}
                      lineId={`bag-note-${idx}-${p.id}`}
                      label={t("product.customerNote.label")}
                      placeholder={t("product.customerNote.placeholder")}
                      maxLength={CUSTOMER_NOTE_MAX_LENGTH}
                      onCommit={(note) =>
                        setBagNote(
                          p.id,
                          note,
                          b.size,
                          b.sizeSelections,
                          b.priceSlotIndex,
                          b.customerNote,
                        )
                      }
                    />
                    <div className="mt-3 flex items-center gap-3">
                      <div
                        className="flex items-center"
                        style={{ border: "1px solid var(--line-strong)" }}
                      >
                        <button
                          type="button"
                          aria-label={t("bag.qtyDecrease")}
                          onClick={() => setBagQty(p.id, b.qty - 1, b.size, b.sizeSelections, b.priceSlotIndex, b.customerNote)}
                          className="px-2 py-1.5"
                        >
                          <Minus className="h-3.5 w-3.5" strokeWidth={1.4} />
                        </button>
                        <span className="px-3 text-sm">{b.qty}</span>
                        <button
                          type="button"
                          aria-label={t("bag.qtyIncrease")}
                          onClick={() => setBagQty(p.id, b.qty + 1, b.size, b.sizeSelections, b.priceSlotIndex, b.customerNote)}
                          disabled={atMax}
                          className="px-2 py-1.5 disabled:opacity-40"
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={1.4} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromBag(p.id, b.size, b.sizeSelections, b.priceSlotIndex, b.customerNote)}
                        aria-label={t("bag.remove")}
                        className="opacity-65 hover:opacity-100"
                      >
                        <X className="h-4 w-4" strokeWidth={1.4} />
                      </button>
                    </div>
                  </div>
                  <div className="pt-1">
                    <ProductPrice
                    amount={resolveProductUnitPrice(p, b.priceSlotIndex) * b.qty}
                    currency={p.currency}
                    size="sm"
                    align="end"
                  />
                  </div>
                </li>
                );
              })}
              <div className="border-t" style={{ borderColor: "var(--line)" }} />
            </ul>

            <aside
              className="self-start"
              style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
            >
              <div className="p-8">
                <h3 className="font-display text-2xl">{t("checkout.summary")}</h3>
                <div className="mt-7 flex flex-col items-end gap-0.5 text-sm">
                  <div className="flex w-full items-center justify-between">
                    <span className="opacity-75">{t("common.subtotal")}</span>
                    <span>{subtotalDisplay.primary}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="opacity-75">{t("checkout.shipping")}</span>
                  <span className="opacity-75">{t("checkout.shippingFlat")}</span>
                </div>
                <div className="mt-6 hairline" />
                {hasStockIssues && (
                  <p className="text-sm text-[var(--color-bordeaux)]" role="alert">
                    {t("stock.bagInvalid")}
                  </p>
                )}
                <button
                  type="button"
                  onClick={onCheckout}
                  disabled={hasStockIssues}
                  className="btn-primary mt-8 w-full disabled:opacity-50"
                >
                  {hasStockIssues ? t("stock.cannotCheckout") : t("common.checkout")}
                </button>
                <p className="mt-5 text-xs opacity-65">{t("delivery.iraqAndInternational")}</p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
