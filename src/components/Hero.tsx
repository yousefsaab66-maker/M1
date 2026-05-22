"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Volume2, VolumeX } from "lucide-react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useStore } from "@/components/providers/StoreProvider";
import { HERO_POSTER, HERO_VIDEO_FALLBACK, HERO_VIDEO_URL } from "@/lib/catalog";

const SOUND_PREF_KEY = "muhra-hero-sound-v1";

export function Hero() {
  const { t } = useLocale();
  const { site } = useStore();
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoOk, setVideoOk] = useState(true);
  const override = site.heroVideo?.trim() ? site.heroVideo : null;
  const [videoSrc, setVideoSrc] = useState<string>(override ?? HERO_VIDEO_URL);
  const [loadVideo, setLoadVideo] = useState(false);
  const [muted, setMuted] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setLoadVideo(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Sync source when the staff-managed override changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVideoOk(true);
    setVideoSrc(override ?? HERO_VIDEO_URL);
  }, [override]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onError = () => {
      if (override) {
        setVideoSrc(HERO_VIDEO_URL);
      } else if (videoSrc !== HERO_VIDEO_FALLBACK) {
        setVideoSrc(HERO_VIDEO_FALLBACK);
      } else {
        setVideoOk(false);
      }
    };
    v.addEventListener("error", onError);
    return () => v.removeEventListener("error", onError);
  }, [videoSrc, override]);

  const flashToast = useCallback(() => {
    setShowToast(true);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setShowToast(false);
      toastTimerRef.current = null;
    }, 3200);
  }, []);

  const enableSound = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return false;
    try {
      v.muted = false;
      v.volume = 0.6;
      await v.play();
      setMuted(false);
      try {
        localStorage.setItem(SOUND_PREF_KEY, "on");
      } catch {
        /* ignore */
      }
      return true;
    } catch {
      v.muted = true;
      setMuted(true);
      flashToast();
      return false;
    }
  }, [flashToast]);

  const disableSound = useCallback(() => {
    const v = videoRef.current;
    if (v) v.muted = true;
    setMuted(true);
    try {
      localStorage.setItem(SOUND_PREF_KEY, "off");
    } catch {
      /* ignore */
    }
  }, []);

  const onToggleSound = useCallback(() => {
    if (muted) {
      void enableSound();
    } else {
      disableSound();
    }
  }, [muted, enableSound, disableSound]);

  // If the user previously enabled sound, attempt to auto-unmute on the first
  // user gesture (autoplay policy compliant).
  useEffect(() => {
    let pref: string | null = null;
    try {
      pref = localStorage.getItem(SOUND_PREF_KEY);
    } catch {
      pref = null;
    }
    if (pref !== "on") return;
    const onGesture = () => {
      void enableSound();
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
    window.addEventListener("pointerdown", onGesture, { once: true });
    window.addEventListener("keydown", onGesture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [enableSound]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  return (
    <section
      className="relative h-[100svh] w-full overflow-hidden"
      style={{ background: "var(--color-onyx)", color: "var(--color-ivory)" }}
    >
      <div
        className="hero-fallback"
        style={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ["--hero-fallback-image" as any]: `url(${HERO_POSTER})`,
        }}
        aria-hidden
      />
      {videoOk && loadVideo && (
        <video
          key={videoSrc}
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={videoSrc}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={HERO_POSTER}
          aria-hidden
        />
      )}
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.25) 30%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* Sound toggle */}
      <button
        type="button"
        onClick={onToggleSound}
        title={muted ? t("hero.sound.off") : t("hero.sound.on")}
        aria-label={t("hero.sound.aria")}
        aria-pressed={!muted}
        className="hero-sound-btn"
      >
        {muted ? (
          <VolumeX className="h-5 w-5" strokeWidth={1.4} aria-hidden />
        ) : (
          <Volume2 className="h-5 w-5" strokeWidth={1.4} aria-hidden />
        )}
        <span className="sr-only">
          {muted ? t("hero.sound.off") : t("hero.sound.on")}
        </span>
      </button>

      {/* Toast (shown when autoplay-with-sound is rejected) */}
      <div
        role="status"
        aria-live="polite"
        className={`hero-sound-toast ${showToast ? "is-visible" : ""}`}
      >
        {t("hero.sound.toast")}
      </div>

      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center ps-[calc(1.5rem+env(safe-area-inset-left,0px))] pe-[calc(1.5rem+env(safe-area-inset-right,0px))] pb-[env(safe-area-inset-bottom,0px)] text-center sm:ps-[calc(2rem+env(safe-area-inset-left,0px))] sm:pe-[calc(2rem+env(safe-area-inset-right,0px))]">
        <motion.span
          className="eyebrow"
          style={{ color: "var(--color-gold)" }}
          initial={{ opacity: 0, y: 12 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.22, 0.61, 0.36, 1], delay: 0.1 }}
        >
          {site.brandName}
        </motion.span>
        <motion.h1
          className="font-display mt-6 max-w-5xl text-5xl leading-[1.05] md:text-7xl xl:text-8xl"
          style={{ letterSpacing: "0.01em" }}
          initial={{ opacity: 0, y: 24 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 1.4, ease: [0.22, 0.61, 0.36, 1], delay: 0.25 }}
        >
          {site.heroHeadline?.trim() || t("hero.headline")}
        </motion.h1>
        <motion.p
          className="mx-auto mt-6 max-w-xl text-base leading-relaxed opacity-90 md:text-lg"
          initial={{ opacity: 0, y: 16 }}
          animate={reduceMotion ? undefined : { opacity: 0.9, y: 0 }}
          transition={{ duration: 1.2, ease: [0.22, 0.61, 0.36, 1], delay: 0.5 }}
        >
          {site.heroSubhead?.trim() || t("hero.sub")}
        </motion.p>
        <motion.div
          className="mt-12 flex flex-wrap items-center justify-center gap-4"
          initial={{ opacity: 0, y: 16 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.22, 0.61, 0.36, 1], delay: 0.75 }}
        >
          <Link href={"/collections" as never} className="btn-primary" style={{ background: "var(--color-ivory)", color: "var(--color-onyx)", borderColor: "var(--color-ivory)" }}>
            {t("hero.cta")}
          </Link>
          <Link
            href={"/high-jewelry" as never}
            className="btn-ghost"
            style={{ color: "var(--color-ivory)", borderColor: "rgba(246,241,231,0.55)" }}
          >
            {t("hero.cta2")}
          </Link>
        </motion.div>
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={reduceMotion ? undefined : { opacity: 1 }}
          transition={{ duration: 1.6, delay: 1.6 }}
          aria-hidden
        >
          <span className="flex flex-col items-center gap-2 text-[10px] tracking-eyebrow uppercase opacity-70">
            {t("hero.scroll")}
            <ChevronDown className="h-4 w-4" strokeWidth={1.2} />
          </span>
        </motion.div>
      </div>

      <style jsx>{`
        .hero-sound-btn {
          position: absolute;
          right: 1.25rem;
          bottom: 1.25rem;
          z-index: 20;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 3rem;
          height: 3rem;
          border-radius: 9999px;
          background: color-mix(in srgb, #0a0a0a 55%, transparent);
          color: var(--color-ivory);
          border: 1px solid rgba(246, 241, 231, 0.55);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          transition:
            background 0.4s var(--ease-luxe),
            border-color 0.4s var(--ease-luxe),
            transform 0.4s var(--ease-luxe);
        }
        :global([dir="rtl"]) .hero-sound-btn {
          right: auto;
          left: 1.25rem;
        }
        .hero-sound-btn:hover {
          background: color-mix(in srgb, #0a0a0a 75%, transparent);
          border-color: var(--color-gold);
          transform: scale(1.04);
        }
        .hero-sound-btn:focus-visible {
          outline: 2px solid var(--color-gold);
          outline-offset: 2px;
        }
        :global([data-theme="light"]) .hero-sound-btn {
          background: color-mix(in srgb, #f6f1e7 25%, transparent);
        }
        :global([data-theme="light"]) .hero-sound-btn:hover {
          background: color-mix(in srgb, #f6f1e7 45%, transparent);
        }
        .hero-sound-toast {
          position: absolute;
          right: 1.25rem;
          bottom: 4.75rem;
          z-index: 20;
          padding: 0.6rem 0.95rem;
          font-size: 0.72rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          background: color-mix(in srgb, #0a0a0a 78%, transparent);
          color: var(--color-ivory);
          border: 1px solid rgba(246, 241, 231, 0.4);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          opacity: 0;
          transform: translateY(6px);
          pointer-events: none;
          transition:
            opacity 0.4s var(--ease-luxe),
            transform 0.4s var(--ease-luxe);
          max-width: 18rem;
        }
        :global([dir="rtl"]) .hero-sound-toast {
          right: auto;
          left: 1.25rem;
        }
        .hero-sound-toast.is-visible {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
    </section>
  );
}
