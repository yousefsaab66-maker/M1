"use client";

import { usePathname } from "next/navigation";
import { WhatsAppFab } from "@/components/layout/WhatsAppFab";

export function ConditionalWhatsAppFab() {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/staff")) return null;
  return <WhatsAppFab />;
}
