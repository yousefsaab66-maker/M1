"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Heart,
  Menu,
  Moon,
  Search,
  ShoppingBag,
  Sun,
  User,
  X,
} from "lucide-react";
import { useStore } from "@/components/providers/StoreProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { LOCALES, type Locale } from "@/lib/i18n";
import { Wordmark } from "@/components/Wordmark";
import { useSiteCopy } from "@/components/hooks/useSiteCopy";
import type { SiteCopyKey } from "@/lib/site-copy";
import { navCustomCategories, productCategoryLabel } from "@/lib/site-display";

const NAV: { href: string; key: string }[] = [
  { href: "/collections", key: "nav.collections" },
  { href: "/high-jewelry", key: "nav.high-jewelry" },
  { href: "/watches", key: "nav.watches" },
  { href: "/bridal", key: "nav.bridal" },
  { href: "/story", key: "nav.story" },
  { href: "/journal", key: "nav.journal" },
  { href: "/boutiques", key: "nav.boutiques" },
];

export function Header() {
  const { bagCount, wishlist, site } = useStore();
  const { t, locale, setLocale } = useLocale();
  const tc = useSiteCopy();
  const { theme, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const customNav = navCustomCategories(site);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (drawer || search) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer, search]);

  return (
    <>
      <div className="bg-onyx text-ivory pt-[env(safe-area-inset-top,0px)]" style={{ background: "var(--color-onyx)", color: "var(--color-ivory)" }}>
        <div className="overflow-hidden">
          <div className="marquee py-2 text-[10px] tracking-eyebrow uppercase opacity-90">
            {Array.from({ length: 2 }).map((_, dup) => (
              <span key={dup} className="flex gap-16">
                <span>— {tc("ticker.line1")}</span>
                <span>— {tc("ticker.line2")}</span>
                <span>— {tc("ticker.line3")}</span>
                <span>— {tc("ticker.line4")}</span>
                <span>— {tc("ticker.line1")}</span>
                <span>— {tc("ticker.line2")}</span>
                <span>— {tc("ticker.line3")}</span>
                <span>— {tc("ticker.line4")}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <header
        className={`sticky top-0 z-40 transition-all duration-500 ${
          scrolled ? "glass-bar-solid" : "glass-bar"
        }`}
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 py-4 ps-[calc(1.25rem+env(safe-area-inset-left,0px))] pe-[calc(1.25rem+env(safe-area-inset-right,0px))] md:ps-[calc(2.5rem+env(safe-area-inset-left,0px))] md:pe-[calc(2.5rem+env(safe-area-inset-right,0px))]">
          <div className="flex flex-1 items-center gap-4">
            <button
              type="button"
              aria-label={t("common.menu")}
              onClick={() => setDrawer(true)}
              className="lg:hidden"
            >
              <Menu className="h-5 w-5" strokeWidth={1.4} />
            </button>
            <nav className="hidden items-center gap-7 lg:flex">
              {NAV.slice(0, 4).map((item) => (
                <Link
                  key={item.href}
                  href={item.href as never}
                  className="gold-underline text-[11px] tracking-eyebrow uppercase opacity-90 hover:opacity-100"
                >
                  {tc(item.key as SiteCopyKey)}
                </Link>
              ))}
              {customNav.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/products?category=${cat.slug}` as never}
                  className="gold-underline text-[11px] tracking-eyebrow uppercase opacity-90 hover:opacity-100"
                >
                  {productCategoryLabel(cat.slug, site, t, locale)}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex flex-1 justify-center">
            <Wordmark size="md" />
          </div>

          <div className="flex flex-1 items-center justify-end gap-4 md:gap-5">
            <nav className="hidden items-center gap-6 lg:flex">
              {NAV.slice(4).map((item) => (
                <Link
                  key={item.href}
                  href={item.href as never}
                  className="gold-underline text-[11px] tracking-eyebrow uppercase opacity-90 hover:opacity-100"
                >
                  {tc(item.key as SiteCopyKey)}
                </Link>
              ))}
            </nav>
            <button
              type="button"
              aria-label={t("nav.search")}
              onClick={() => setSearch(true)}
              className="opacity-90 hover:opacity-100"
            >
              <Search className="h-[18px] w-[18px]" strokeWidth={1.3} />
            </button>
            <LocalePicker locale={locale} onChange={setLocale} />
            <button
              type="button"
              aria-label={t("theme.toggle")}
              onClick={toggle}
              className="opacity-90 hover:opacity-100"
            >
              {theme === "dark" ? (
                <Sun className="h-[18px] w-[18px]" strokeWidth={1.3} />
              ) : (
                <Moon className="h-[18px] w-[18px]" strokeWidth={1.3} />
              )}
            </button>
            <Link
              href={"/account" as never}
              aria-label={t("nav.account")}
              className="opacity-90 hover:opacity-100"
            >
              <User className="h-[18px] w-[18px]" strokeWidth={1.3} />
            </Link>
            <Link
              href={"/wishlist" as never}
              aria-label={t("nav.wishlist")}
              className="relative opacity-90 hover:opacity-100"
            >
              <Heart className="h-[18px] w-[18px]" strokeWidth={1.3} />
              {wishlist.length > 0 && (
                <span className="absolute -top-1 -right-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-medium" style={{ background: "var(--color-gold)", color: "var(--color-onyx)" }}>
                  {wishlist.length}
                </span>
              )}
            </Link>
            <Link
              href={"/bag" as never}
              aria-label={t("nav.bag")}
              className="relative opacity-90 hover:opacity-100"
            >
              <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.3} />
              {bagCount > 0 && (
                <span
                  className="absolute -top-1 -right-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-medium"
                  style={{ background: "var(--color-gold)", color: "var(--color-onyx)" }}
                  aria-live="polite"
                >
                  {bagCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {drawer && (
          <MobileDrawer onClose={() => setDrawer(false)} customNav={customNav} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {search && <SearchOverlay onClose={() => setSearch(false)} />}
      </AnimatePresence>
    </>
  );
}

function LocalePicker({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (l: Locale) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[11px] tracking-eyebrow uppercase opacity-90 hover:opacity-100"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {locale.toUpperCase()}
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
            role="listbox"
            className="absolute end-0 mt-3 min-w-[160px] py-2"
            style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
          >
            {LOCALES.map((l) => (
              <li key={l.code}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(l.code);
                    setOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-start text-[11px] tracking-eyebrow uppercase ${
                    locale === l.code ? "opacity-100" : "opacity-70 hover:opacity-100"
                  }`}
                >
                  {l.native}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileDrawer({
  onClose,
  customNav,
}: {
  onClose: () => void;
  customNav: ReturnType<typeof navCustomCategories>;
}) {
  const { t, locale } = useLocale();
  const { site } = useStore();
  const tc = useSiteCopy();
  return (
    <motion.div
      className="fixed inset-0 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={onClose}
        aria-hidden
      />
      <motion.aside
        className="absolute inset-y-0 start-0 flex h-full w-[88%] max-w-[420px] flex-col"
        style={{ background: "var(--background)", borderInlineEnd: "1px solid var(--line)" }}
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1] }}
      >
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid var(--line)" }}>
          <Wordmark size="sm" align="left" />
          <button type="button" aria-label={t("common.close")} onClick={onClose}>
            <X className="h-5 w-5" strokeWidth={1.4} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-6 py-8">
          <ul className="flex flex-col gap-5">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href as never}
                  onClick={onClose}
                  className="font-display text-2xl tracking-wide"
                >
                  {tc(item.key as SiteCopyKey)}
                </Link>
              </li>
            ))}
            {customNav.length > 0 && (
              <li className="mt-4 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
                <p className="eyebrow mb-4 text-[10px]">{t("filter.category")}</p>
                <ul className="flex flex-col gap-3">
                  {customNav.map((cat) => (
                    <li key={cat.id}>
                      <Link
                        href={`/products?category=${cat.slug}` as never}
                        onClick={onClose}
                        className="font-display text-xl tracking-wide opacity-90"
                      >
                        {productCategoryLabel(cat.slug, site, t, locale)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            )}
            <li className="mt-6 pt-6" style={{ borderTop: "1px solid var(--line)" }}>
              <Link
                href={"/account" as never}
                onClick={onClose}
                className="text-[11px] tracking-eyebrow uppercase opacity-80"
              >
                {t("nav.account")}
              </Link>
            </li>
            <li>
              <Link
                href={"/wishlist" as never}
                onClick={onClose}
                className="text-[11px] tracking-eyebrow uppercase opacity-80"
              >
                {t("nav.wishlist")}
              </Link>
            </li>
            <li>
              <Link
                href={"/bag" as never}
                onClick={onClose}
                className="text-[11px] tracking-eyebrow uppercase opacity-80"
              >
                {t("nav.bag")}
              </Link>
            </li>
            <li>
              <Link
                href={"/staff/login" as never}
                onClick={onClose}
                className="text-[11px] tracking-eyebrow uppercase opacity-50"
              >
                {t("staff.signin")}
              </Link>
            </li>
          </ul>
        </nav>
      </motion.aside>
    </motion.div>
  );
}

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const { products, site } = useStore();
  const { t, locale } = useLocale();
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const matches = ql
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(ql) ||
          p.collection.toLowerCase().includes(ql) ||
          p.category.toLowerCase().includes(ql),
      )
    : [];
  return (
    <motion.div
      className="fixed inset-0 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        className="absolute inset-x-0 top-0 page-gutter py-8 md:py-14"
        style={{ background: "var(--background)", borderBottom: "1px solid var(--line)" }}
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -40, opacity: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
      >
        <div className="mx-auto flex max-w-[1100px] items-center gap-5">
          <Search className="h-5 w-5 opacity-60" strokeWidth={1.3} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("nav.search")}
            className="font-display flex-1 bg-transparent text-2xl tracking-wide outline-none md:text-4xl"
          />
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={onClose}
            className="opacity-70 hover:opacity-100"
          >
            <X className="h-5 w-5" strokeWidth={1.4} />
          </button>
        </div>
        {matches.length > 0 && (
          <ul className="mx-auto mt-8 grid max-w-[1100px] grid-cols-1 gap-3 md:grid-cols-2">
            {matches.slice(0, 8).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/products/${p.slug}` as never}
                  onClick={onClose}
                  className="flex items-center justify-between border px-4 py-3 hover:opacity-90"
                  style={{ borderColor: "var(--line)" }}
                >
                  <span className="font-display text-lg">{p.name}</span>
                  <span className="eyebrow opacity-70">
                    {productCategoryLabel(p.category, site, t, locale)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </motion.div>
  );
}
