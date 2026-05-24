"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Globe, Truck } from "lucide-react";
import { SectionTitle } from "@/components/Section";
import { SafeImage } from "@/components/SafeImage";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useStore, type BagItem, type OrderCustomer } from "@/components/providers/StoreProvider";
import type { Product } from "@/lib/catalog";
import {
  CHECKOUT_COUNTRIES,
  IRAQ_COUNTRY_CODE,
  isValidInternationalPhone,
  type CountryCode,
} from "@/lib/countries";
import { ProductPrice } from "@/components/ProductPrice";
import { formatCustomerPrice, getCustomerPriceParts } from "@/lib/customer-price";
import {
  IRAQ_GOVERNORATES,
  IRAQI_PHONE_REGEX,
  SHIPPING_FEE_IQD,
  formatIqd,
  isIraqCountry,
  normalizeIraqiPhone,
  toIqd,
  type GovernorateCode,
} from "@/lib/iraq";
import { getUsdIqdRate } from "@/lib/site-display";

type FieldErrors = Partial<{
  name: string;
  phone: string;
  country: string;
  governorate: string;
  city: string;
  address: string;
}>;

export default function CheckoutPage() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const { bag, products, placeOrder, hydrated, site } = useStore();

  const items = useMemo(
    () =>
      bag
        .map((b) => ({ b, p: products.find((p) => p.id === b.productId) }))
        .filter((x): x is { b: BagItem; p: Product } => Boolean(x.p)),
    [bag, products],
  );
  const subtotal = items.reduce((s, { b, p }) => s + p.price * b.qty, 0);
  const currency = items[0]?.p.currency ?? "EUR";
  const usdIqdRate = getUsdIqdRate(site);
  const rateOpts = { usdIqdRate };
  const subtotalIqd = toIqd(subtotal, currency, rateOpts);
  const subtotalDisplay = getCustomerPriceParts(subtotal, currency, locale, rateOpts);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<CountryCode>(IRAQ_COUNTRY_CODE);
  const [governorate, setGovernorate] = useState<GovernorateCode | "">("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const isIraq = isIraqCountry(country);
  const shippingFeeIqd = isIraq ? SHIPPING_FEE_IQD : undefined;
  const totalIqd = subtotalIqd + (shippingFeeIqd ?? 0);

  useEffect(() => {
    if (hydrated && items.length === 0 && !submitting) {
      // Allow the empty state below to render; no redirect — keeps /checkout addressable.
    }
  }, [hydrated, items.length, submitting]);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = t("v.required");
    if (!country) next.country = t("v.country");
    if (!phone.trim()) next.phone = t("v.required");
    else if (isIraq) {
      if (!IRAQI_PHONE_REGEX.test(phone.replace(/[\s\-().]/g, ""))) next.phone = t("v.phone");
    } else if (!isValidInternationalPhone(phone)) {
      next.phone = t("v.phoneInternational");
    }
    if (isIraq && !governorate) next.governorate = t("v.governorate");
    if (!city.trim()) next.city = t("v.required");
    if (!address.trim()) next.address = t("v.required");
    return next;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError(null);
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const firstKey = Object.keys(next)[0];
      const el = document.querySelector<HTMLElement>(`[data-field="${firstKey}"]`);
      el?.focus();
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    const customer: OrderCustomer = {
      name: name.trim(),
      phone: isIraq ? (normalizeIraqiPhone(phone) ?? phone.trim()) : phone.trim(),
      country,
      ...(isIraq && governorate ? { governorate: governorate as GovernorateCode } : {}),
      city: city.trim(),
      address: address.trim(),
      notes: notes.trim() || undefined,
      ...(!isIraq ? { international: true } : {}),
    };
    const result = await placeOrder({ customer, payment: { method: "cod" } });
    if (!result.ok) {
      setSubmitting(false);
      const errKey =
        result.error === "rate_limited"
          ? "checkout.rateLimited"
          : result.error === "invalid_phone"
            ? isIraq
              ? "v.phone"
              : "v.phoneInternational"
            : "checkout.orderFailed";
      setOrderError(t(errKey));
      return;
    }
    router.push(`/checkout/success?orderId=${encodeURIComponent(result.order.id)}` as never);
  };

  if (!hydrated) {
    return <div className="px-6 py-32 text-center opacity-60">…</div>;
  }

  if (items.length === 0) {
    return (
      <div className="px-5 py-20 md:px-10 md:py-28">
        <SectionTitle eyebrow={t("checkout.eyebrow")} title={t("checkout.heading")} />
        <div className="mx-auto mt-12 max-w-md text-center">
          <p className="font-display text-3xl">{t("checkout.empty.title")}</p>
          <p className="mt-3 opacity-75">{t("checkout.empty.body")}</p>
          <Link href={"/products" as never} className="btn-primary mt-8 inline-flex">
            {t("checkout.empty.cta")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-16 md:px-10 md:py-24">
      <SectionTitle eyebrow={t("checkout.eyebrow")} title={t("checkout.heading")} />
      <p className="mt-4 text-center text-[12px] tracking-eyebrow uppercase opacity-70">
        {t("delivery.iraqAndInternational")}
      </p>

      <form
        onSubmit={onSubmit}
        className="mx-auto mt-12 grid max-w-[1300px] gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14"
        noValidate
      >
        <div className="space-y-10">
          <section>
            <h3 className="font-display text-2xl">{t("checkout.contact")}</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <CheckoutField label={t("checkout.fullName")} error={errors.name}>
                <input
                  data-field="name"
                  className="input-luxe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </CheckoutField>
              <CheckoutField
                label={t("checkout.phone")}
                hint={isIraq ? t("checkout.phoneHint") : t("checkout.phoneHintInternational")}
                error={errors.phone}
              >
                <input
                  data-field="phone"
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  className="input-luxe"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={isIraq ? "07XXXXXXXXX" : "+1 234 567 8900"}
                  required
                />
              </CheckoutField>
            </div>
          </section>

          <section>
            <h3 className="font-display text-2xl">
              {isIraq ? t("checkout.shippingAddress") : t("checkout.shippingAddressInternational")}
            </h3>
            {!isIraq && (
              <div
                className="mt-5 flex gap-3 p-5"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--color-gold)",
                }}
                role="status"
              >
                <Globe
                  className="mt-0.5 h-5 w-5 shrink-0"
                  strokeWidth={1.4}
                  style={{ color: "var(--color-gold)" }}
                  aria-hidden
                />
                <p className="text-sm leading-relaxed opacity-90">{t("checkout.internationalNotice")}</p>
              </div>
            )}
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <CheckoutField label={t("checkout.country")} error={errors.country}>
                <select
                  data-field="country"
                  className="input-luxe"
                  value={country}
                  onChange={(e) => {
                    const next = e.target.value as CountryCode;
                    setCountry(next);
                    if (next !== IRAQ_COUNTRY_CODE) setGovernorate("");
                  }}
                  required
                >
                  {CHECKOUT_COUNTRIES.map((code) => (
                    <option key={code} value={code}>
                      {t(`country.${code}`)}
                    </option>
                  ))}
                </select>
              </CheckoutField>
              {isIraq ? (
                <CheckoutField label={t("checkout.governorate")} error={errors.governorate}>
                  <select
                    data-field="governorate"
                    className="input-luxe"
                    value={governorate}
                    onChange={(e) => setGovernorate(e.target.value as GovernorateCode | "")}
                    required
                  >
                    <option value="">{t("checkout.governorate.placeholder")}</option>
                    {IRAQ_GOVERNORATES.map((code) => (
                      <option key={code} value={code}>
                        {t(`governorate.${code}`)}
                      </option>
                    ))}
                  </select>
                </CheckoutField>
              ) : (
                <div className="hidden md:block" aria-hidden />
              )}
            </div>
            <div className="mt-4">
              <CheckoutField label={t("checkout.city")} error={errors.city}>
                <input
                  data-field="city"
                  className="input-luxe"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                />
              </CheckoutField>
            </div>
            <div className="mt-4">
              <CheckoutField label={t("checkout.address")} error={errors.address}>
                <input
                  data-field="address"
                  className="input-luxe"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
              </CheckoutField>
            </div>
            <div className="mt-4">
              <CheckoutField label={t("checkout.notes")}>
                <textarea
                  className="input-luxe"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </CheckoutField>
            </div>
          </section>

          <section>
            <h3 className="font-display text-2xl">{t("checkout.payment")}</h3>
            <p className="mt-2 text-[11px] tracking-eyebrow uppercase opacity-65">
              {t("pay.method")}
            </p>
            <div
              className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-stretch"
              role="group"
              aria-label={t("pay.cod")}
            >
              <div
                className="flex flex-1 flex-col gap-3 p-5 text-start"
                style={{
                  border: "1px solid var(--color-gold)",
                  background: "var(--surface)",
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center"
                    style={{
                      background: "var(--color-onyx)",
                      color: "var(--color-ivory)",
                      border: "1px solid var(--line-strong)",
                    }}
                    aria-hidden
                  >
                    <Truck className="h-5 w-5" strokeWidth={1.4} />
                  </span>
                  <span className="font-display text-lg leading-tight">{t("pay.cod")}</span>
                </div>
                <p className="text-[12px] leading-relaxed opacity-75">
                  {isIraq ? t("pay.cod.desc") : t("pay.codInternational.desc")}
                </p>
              </div>
            </div>
            <div
              className="mt-6 p-5"
              style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
            >
              <p className="text-sm opacity-80">
                {isIraq ? t("pay.codNote") : t("pay.codInternationalNote")}
              </p>
            </div>
            {orderError && (
              <p className="mt-4 text-sm" style={{ color: "var(--color-bordeaux)" }} role="alert">
                {orderError}
              </p>
            )}
          </section>
        </div>

        <aside
          className="self-start lg:sticky lg:top-28"
          style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
        >
          <div className="p-7">
            <h3 className="font-display text-2xl">{t("checkout.summary")}</h3>
            <ul className="mt-6 flex flex-col gap-4">
              {items.map(({ b, p }) => (
                <li
                  key={p.id + (b.size ?? "")}
                  className="grid grid-cols-[64px_1fr_auto] items-center gap-4"
                >
                  <div
                    className="relative aspect-square overflow-hidden"
                    style={{ background: "var(--surface-2)" }}
                  >
                    {p.images[0] && (
                      <SafeImage
                        src={p.images[0]}
                        alt={p.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-base leading-tight">{p.name}</p>
                    <p className="mt-0.5 text-[10px] tracking-eyebrow uppercase opacity-65">
                      {b.qty} × {formatCustomerPrice(p.price, p.currency, locale, rateOpts)}
                      {b.size ? ` · ${b.size}` : ""}
                    </p>
                  </div>
                  <ProductPrice
                    amount={p.price * b.qty}
                    currency={p.currency}
                    size="sm"
                    align="end"
                    showOriginal={p.currency !== "IQD"}
                  />
                </li>
              ))}
            </ul>
            <div className="hairline my-6" />
            <div className="flex flex-col items-end gap-0.5 text-sm">
              <div className="flex w-full items-center justify-between">
                <span className="opacity-75">{t("common.subtotal")}</span>
                <span>{subtotalDisplay.primary}</span>
              </div>
              {subtotalDisplay.secondary && (
                <p className="text-[11px] opacity-65">
                  {t("price.originalListing").replace("{amount}", subtotalDisplay.secondary)}
                </p>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="opacity-75">{t("checkout.shipping")}</span>
              <span className={isIraq ? "" : "text-[12px] opacity-75"}>
                {isIraq && shippingFeeIqd != null
                  ? formatIqd(shippingFeeIqd, locale)
                  : t("checkout.shippingPending")}
              </span>
            </div>
            <div className="hairline my-6" />
            <div className="flex items-center justify-between">
              <span className="eyebrow">{t("checkout.total")}</span>
              <div className="text-end">
                <p className="font-display text-2xl">{formatIqd(totalIqd, locale)}</p>
                {subtotalDisplay.secondary && (
                  <p className="text-[11px] opacity-65">
                    {t("price.originalListing").replace("{amount}", subtotalDisplay.secondary)}
                  </p>
                )}
                {!isIraq && (
                  <p className="mt-0.5 text-[11px] opacity-65">
                    {t("checkout.totalInternationalHint")}
                  </p>
                )}
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary mt-8 w-full"
            >
              {submitting ? t("checkout.placing") : t("checkout.placeOrder")}
            </button>
            <p className="mt-4 text-[11px] opacity-65 text-center">
              {isIraq ? t("delivery.iraqDomestic") : t("checkout.internationalNoticeShort")}
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}

function CheckoutField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && (
        <span className="mt-1 block text-[11px] opacity-65">{hint}</span>
      )}
      {error && (
        <span
          className="mt-1 block text-[11px]"
          style={{ color: "var(--color-bordeaux)" }}
        >
          {error}
        </span>
      )}
    </label>
  );
}
