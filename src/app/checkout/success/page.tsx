"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { Check } from "lucide-react";
import { SectionTitle } from "@/components/Section";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useStore } from "@/components/providers/StoreProvider";
import { formatPrice } from "@/lib/format";
import { formatIqd, isIraqCountry } from "@/lib/iraq";

function SuccessInner() {
  const sp = useSearchParams();
  const orderId = sp.get("orderId");
  const { orders, hydrated } = useStore();
  const { t, locale } = useLocale();
  const order = useMemo(() => orders.find((o) => o.id === orderId), [orders, orderId]);
  const international =
    Boolean(order?.customer?.international) || !isIraqCountry(order?.customer?.country);
  const countryCode = order?.customer?.country ?? "IQ";
  const countryLabel = t(`country.${countryCode}`);

  return (
    <div className="page-gutter py-20 md:py-28">
      <div className="mx-auto max-w-[860px] text-center">
        <span
          className="inline-flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            background: "var(--color-onyx)",
            color: "var(--color-ivory)",
          }}
          aria-hidden
        >
          <Check className="h-6 w-6" strokeWidth={1.6} />
        </span>
        <SectionTitle eyebrow={t("checkout.eyebrow")} title={t("success.title")} />
        <p className="mt-4 max-w-xl mx-auto opacity-80">{t("success.body")}</p>

        {orderId && (
          <>
            <p className="mt-6 text-[11px] tracking-eyebrow uppercase opacity-65">
              {t("success.orderId")}
            </p>
            <p className="mt-2 font-mono text-lg">{orderId}</p>
          </>
        )}

        {hydrated && order && (
          <div
            className="mx-auto mt-10 max-w-md p-7 text-start"
            style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
          >
            <p className="eyebrow">{t("checkout.summary")}</p>
            <ul className="mt-4 space-y-2">
              {order.items.map((it, idx) => (
                <li key={idx} className="flex items-center justify-between gap-3">
                  <span className="text-sm">
                    {it.name}
                    <span className="opacity-65"> × {it.qty}</span>
                  </span>
                  <span className="text-sm">
                    {formatPrice(it.qty * it.price, order.currency, locale)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="hairline my-5" />
            <div className="flex items-center justify-between text-sm">
              <span className="opacity-75">{t("common.subtotal")}</span>
              <span>{formatPrice(order.subtotal, order.currency, locale)}</span>
            </div>
            {typeof order.shippingFeeIqd === "number" && (
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-75">{t("checkout.shipping")}</span>
                <span>{formatIqd(order.shippingFeeIqd, locale)}</span>
              </div>
            )}
            {international && (
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-75">{t("checkout.shipping")}</span>
                <span className="text-[12px] opacity-75">{t("checkout.shippingPending")}</span>
              </div>
            )}
            {typeof order.totalIqd === "number" && !international && (
              <div className="mt-2 flex items-center justify-between text-sm font-medium">
                <span className="opacity-75">{t("checkout.total")}</span>
                <span>{formatIqd(order.totalIqd, locale)}</span>
              </div>
            )}
            {order.customer && (
              <>
                <div className="hairline my-5" />
                <p className="eyebrow">
                  {international
                    ? t("checkout.shippingAddressInternational")
                    : t("checkout.shippingAddress")}
                </p>
                <p className="mt-2 text-sm leading-relaxed opacity-85">
                  {order.customer.name}
                  <br />
                  {order.customer.phone}
                  <br />
                  {order.customer.address}
                  {order.customer.city ? `, ${order.customer.city}` : ""}
                  <br />
                  {international ? (
                    countryLabel
                  ) : order.customer.governorate ? (
                    <>
                      {t(`governorate.${order.customer.governorate}`)} — {t("country.iraq")}
                    </>
                  ) : (
                    t("country.iraq")
                  )}
                </p>
              </>
            )}
          </div>
        )}

        <p className="mt-10 text-[12px] opacity-70">
          {international ? t("success.internationalEta") : t("success.eta")}
        </p>
        <Link href={"/products" as never} className="btn-primary mt-6 inline-flex">
          {t("success.continue")}
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="px-6 py-32 text-center opacity-60">…</div>}>
      <SuccessInner />
    </Suspense>
  );
}
