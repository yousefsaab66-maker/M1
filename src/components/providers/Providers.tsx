"use client";

import type { Product } from "@/lib/catalog";
import { ConditionalWhatsAppFab } from "@/components/layout/ConditionalWhatsAppFab";
import { AuthProvider } from "./AuthProvider";
import { LocaleProvider } from "./LocaleProvider";
import { StoreProvider } from "./StoreProvider";
import { ThemeProvider } from "./ThemeProvider";

export function Providers({
  children,
  initialRemoteProducts,
}: {
  children: React.ReactNode;
  /** من السيرفر عند تفعيل Supabase — يمنع ظهور منتجات الـ demo في أول طلاء HTML. */
  initialRemoteProducts?: Product[];
}) {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <StoreProvider initialRemoteProducts={initialRemoteProducts}>
          <AuthProvider>
            {children}
            <ConditionalWhatsAppFab />
          </AuthProvider>
        </StoreProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
