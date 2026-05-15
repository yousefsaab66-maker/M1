"use client";

import Image from "next/image";
import { FadeIn } from "@/components/Section";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useStore } from "@/components/providers/StoreProvider";

export default function BoutiquesPage() {
  const { boutiques } = useStore();
  const { t } = useLocale();
  return (
    <div>
      <section
        className="relative overflow-hidden page-gutter py-24 md:py-36"
        style={{ background: "var(--color-onyx)", color: "var(--color-ivory)" }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          aria-hidden
          style={{
            backgroundImage: `radial-gradient(circle at 18% 32%, rgba(184,154,94,0.45), transparent 22%), radial-gradient(circle at 70% 60%, rgba(184,154,94,0.35), transparent 22%), radial-gradient(circle at 45% 80%, rgba(184,154,94,0.4), transparent 22%), radial-gradient(circle at 85% 25%, rgba(184,154,94,0.45), transparent 22%), radial-gradient(circle at 33% 65%, rgba(184,154,94,0.4), transparent 22%)`,
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          aria-hidden
          style={{
            backgroundImage:
              "linear-gradient(rgba(246,241,231,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(246,241,231,0.06) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="relative mx-auto max-w-[1300px] text-center">
          <p className="eyebrow" style={{ color: "var(--color-gold)" }}>
            {t("common.boutiques")}
          </p>
          <h1 className="font-display mt-5 text-5xl md:text-7xl">{t("boutiques.title")}</h1>
          <p className="mx-auto mt-5 max-w-xl opacity-85">{t("boutiques.sub")}</p>
        </div>
      </section>

      <section className="page-gutter py-20 md:py-28">
        <div className="mx-auto grid max-w-[1400px] gap-10 md:grid-cols-2 lg:grid-cols-3">
          {boutiques.map((b, i) => (
            <FadeIn key={b.id} delay={i * 0.06}>
              <div className="card-luxe group flex flex-col">
                <div className="product-image-zoom relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={b.image}
                    alt={t("boutiques.cardAria").replace("{city}", b.city)}
                    fill
                    sizes="(min-width: 1024px) 33vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="p-7">
                  <p className="eyebrow opacity-80">{b.country}</p>
                  <h3 className="font-display mt-3 text-3xl">{b.city}</h3>
                  <p className="mt-4 text-sm leading-relaxed opacity-85">{b.address}</p>
                  <p className="mt-1 text-sm opacity-70">{b.phone}</p>
                  <p className="mt-4 text-[11px] tracking-eyebrow uppercase opacity-65">{b.hours}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>
    </div>
  );
}
