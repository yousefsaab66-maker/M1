"use client";

import { MessageCircle } from "lucide-react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/components/providers/LocaleProvider";

/** العراق 078… → صيغة واتساب الدولية بدون + */
const WHATSAPP_WA_ME = "9647715937565";

function useIsBrowser() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function WhatsAppFab() {
  const { t } = useLocale();
  const isBrowser = useIsBrowser();

  const text = encodeURIComponent(t("common.whatsappPrefill"));
  const href = `https://wa.me/${WHATSAPP_WA_ME}?text=${text}`;

  const node = (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="pointer-events-auto fixed end-6 z-[9999] flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-white shadow-[0_4px_24px_rgba(0,0,0,0.2)] transition-[filter,transform] hover:brightness-105 active:scale-[0.98] sm:px-5"
      style={{
        bottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))",
      }}
      aria-label={t("common.whatsappAria")}
    >
      <MessageCircle className="h-6 w-6 shrink-0" strokeWidth={1.6} aria-hidden />
      <span className="truncate text-[11px] font-medium uppercase tracking-[0.18em] sm:text-xs">
        {t("common.whatsapp")}
      </span>
    </a>
  );

  if (!isBrowser || typeof document === "undefined") return null;
  return createPortal(node, document.body);
}
