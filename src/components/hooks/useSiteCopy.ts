"use client";

import { useCallback } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useStore } from "@/components/providers/StoreProvider";
import { siteCopy, type SiteCopyKey } from "@/lib/site-copy";

/** Storefront label: staff R2 override when set, else active locale i18n. */
export function useSiteCopy() {
  const { site } = useStore();
  const { locale, t } = useLocale();
  return useCallback((key: SiteCopyKey) => siteCopy(site, locale, key, t), [site, locale, t]);
}
