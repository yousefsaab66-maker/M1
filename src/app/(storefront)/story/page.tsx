"use client";

import Image from "next/image";
import { FadeIn } from "@/components/Section";
import { useLocale } from "@/components/providers/LocaleProvider";

const TIMELINE_YEARS = ["1919", "1924", "1962", "1986", "2026"] as const;

export default function StoryPage() {
  const { t } = useLocale();
  return (
    <div>
      <section className="relative h-[70svh] min-h-[520px] overflow-hidden" style={{ background: "var(--color-onyx)" }}>
        <Image
          src="https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=2400&q=80"
          alt={t("story.title")}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.4), rgba(0,0,0,0.65))" }} />
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center" style={{ color: "var(--color-ivory)" }}>
          <p className="eyebrow" style={{ color: "var(--color-gold)" }}>{t("nav.story")}</p>
          <h1 className="font-display mt-5 text-5xl md:text-7xl">{t("story.title")}</h1>
          <p className="mt-5 max-w-xl italic opacity-90">{t("story.lede")}</p>
        </div>
      </section>

      <section className="page-gutter py-24 md:py-32">
        <div className="mx-auto grid max-w-[1300px] gap-14 lg:grid-cols-2 lg:gap-24">
          <FadeIn>
            <div className="relative aspect-[3/4]" style={{ background: "var(--surface-2)" }}>
              <Image
                src="https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=1600&q=80"
                alt=""
                fill
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div>
              <p className="eyebrow">{t("story.maison.eyebrow")}</p>
              <h2 className="font-display mt-5 text-4xl">{t("story.maison.title")}</h2>
              <p className="mt-7 leading-relaxed opacity-85">
                {t("story.maison.body1")}
              </p>
              <p className="mt-5 leading-relaxed opacity-75">
                {t("story.maison.body2")}
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="page-gutter py-20 md:py-28" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-3xl">
          <p className="eyebrow text-center">{t("story.timeline.eyebrow")}</p>
          <h2 className="font-display mt-5 text-center text-4xl">{t("story.timeline.title")}</h2>
        </div>
        <div className="mx-auto mt-16 grid max-w-[1100px] gap-10">
          {TIMELINE_YEARS.map((year, i) => (
            <FadeIn key={year} delay={i * 0.06}>
              <div className="grid items-start gap-4 md:grid-cols-[120px_1fr_1fr] md:gap-12">
                <p className="font-display text-3xl">{year}</p>
                <h3 className="font-display text-2xl">{t(`story.timeline.${i + 1}.title`)}</h3>
                <p className="leading-relaxed opacity-80">{t(`story.timeline.${i + 1}.copy`)}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>
    </div>
  );
}
