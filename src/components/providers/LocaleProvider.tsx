"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { DICTS, RTL_LOCALES, type Locale } from "@/lib/i18n";

type LocaleCtx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
};

const LocaleContext = createContext<LocaleCtx | null>(null);
const STORAGE_KEY = "muhra-locale-v1";

const localeListeners = new Set<() => void>();

function subscribeLocale(onStoreChange: () => void) {
  localeListeners.add(onStoreChange);
  if (typeof window === "undefined") {
    return () => {
      localeListeners.delete(onStoreChange);
    };
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    localeListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function notifyLocaleListeners() {
  localeListeners.forEach((fn) => fn());
}

function readLocaleFromStorage(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in DICTS) return stored as Locale;
  } catch {
    /* ignore */
  }
  return "en";
}

function getServerLocaleSnapshot(): Locale {
  return "en";
}

function applyLocaleToDocument(locale: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("lang", locale);
  document.documentElement.setAttribute(
    "dir",
    RTL_LOCALES.includes(locale) ? "rtl" : "ltr",
  );
}

/**
 * Locale from localStorage must not win on the very first client render during hydration,
 * or RTL/LTR + translated strings diverge from the server HTML (flex-row-reverse vs flex-row, etc.).
 * `useSyncExternalStore` + `getServerSnapshot` keeps the first paint aligned with SSR, then updates.
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(
    subscribeLocale,
    readLocaleFromStorage,
    getServerLocaleSnapshot,
  );

  useEffect(() => {
    applyLocaleToDocument(locale);
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    notifyLocaleListeners();
  }, []);

  const translate = useCallback(
    (key: string) => DICTS[locale]?.[key] ?? DICTS.en[key] ?? key,
    [locale],
  );

  const value = useMemo<LocaleCtx>(
    () => ({
      locale,
      setLocale,
      t: translate,
      dir: RTL_LOCALES.includes(locale) ? "rtl" : "ltr",
    }),
    [locale, setLocale, translate],
  );

  return (
    <LocaleContext.Provider value={value}>
      <span className="contents">{children}</span>
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used inside LocaleProvider");
  return ctx;
}
