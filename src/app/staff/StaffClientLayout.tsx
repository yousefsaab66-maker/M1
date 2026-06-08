"use client";

import { useEffect } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { DICTS, type Locale } from "@/lib/i18n";

const STORAGE_KEY = "muhra-locale-v1";

/**
 * لوحة الموظفين بالعربية افتراضياً؛ عند مغادرة /staff تُستعاد لغة الزائر السابقة.
 */
export default function StaffClientLayout({ children }: { children: React.ReactNode }) {
  const { setLocale } = useLocale();

  useEffect(() => {
    let previous: string | null = null;
    try {
      previous = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setLocale("ar");
    return () => {
      if (previous && previous in DICTS) setLocale(previous as Locale);
      else setLocale("en");
    };
  }, [setLocale]);

  return <>{children}</>;
}
