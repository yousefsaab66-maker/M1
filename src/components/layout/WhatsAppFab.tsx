"use client";

import { MessageCircle } from "lucide-react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/components/providers/LocaleProvider";

/** العراق 078… → صيغة واتساب الدولية بدون + */
const WHATSAPP_RETAIL = "9647715937565";
const WHATSAPP_WHOLESALE = "9647513261257";

const FAB_CLASS =
  "pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-white shadow-[0_4px_24px_rgba(0,0,0,0.2)] transition-[filter,transform] hover:brightness-105 active:scale-[0.98] sm:px-5";

function useIsBrowser() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

type WhatsAppFabLinkProps = {
  href: string;
  ariaLabel: string;
  label: string;
  compact?: boolean;
};

function WhatsAppFabLink({ href, ariaLabel, label, compact }: WhatsAppFabLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={FAB_CLASS}
      aria-label={ariaLabel}
    >
      <MessageCircle className="h-6 w-6 shrink-0" strokeWidth={1.6} aria-hidden />
      <span
        className={
          compact
            ? "text-[10px] font-medium leading-tight sm:text-[11px]"
            : "truncate text-[11px] font-medium uppercase tracking-[0.18em] sm:text-xs"
        }
      >
        {label}
      </span>
    </a>
  );
}

export function WhatsAppFab() {
  const { t } = useLocale();
  const isBrowser = useIsBrowser();

  const retailText = encodeURIComponent(t("common.whatsappPrefill"));
  const wholesaleText = encodeURIComponent(t("common.whatsappWholesalePrefill"));

  const retailHref = `https://wa.me/${WHATSAPP_RETAIL}?text=${retailText}`;
  const wholesaleHref = `https://wa.me/${WHATSAPP_WHOLESALE}?text=${wholesaleText}`;

  const node = (
    <div
      className="fixed end-6 z-[9999] flex flex-col items-end gap-2"
      style={{
        bottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <WhatsAppFabLink
        href={wholesaleHref}
        ariaLabel={t("common.whatsappWholesaleAria")}
        label={t("common.whatsappWholesale")}
        compact
      />
      <WhatsAppFabLink
        href={retailHref}
        ariaLabel={t("common.whatsappAria")}
        label={t("common.whatsapp")}
      />
    </div>
  );

  if (!isBrowser || typeof document === "undefined") return null;
  return createPortal(node, document.body);
}
