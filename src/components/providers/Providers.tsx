"use client";

import { usePathname } from "next/navigation";
import type { Product } from "@/lib/catalog";
import { ConditionalWhatsAppFab } from "@/components/layout/ConditionalWhatsAppFab";
import { AuthProvider } from "./AuthProvider";
import { LocaleProvider } from "./LocaleProvider";
import { MinimalStoreProvider, StoreProvider } from "./StoreProvider";
import { ThemeProvider } from "./ThemeProvider";

function isStaffLoginPath(pathname: string): boolean {
  return pathname === "/staff/login" || pathname.startsWith("/staff/login/");
}

export function Providers({
  children,
  initialRemoteProducts,
}: {
  children: React.ReactNode;
  /** من السيرفر عند تفعيل Supabase — يمنع ظهور منتجات الـ demo في أول طلاء HTML. */
  initialRemoteProducts?: Product[];
}) {
  const pathname = usePathname() ?? "";
  const staffLogin = isStaffLoginPath(pathname);

  const storeTree = staffLogin ? (
    <MinimalStoreProvider>
      <AuthProvider staffSessionOnly>
        {children}
        <ConditionalWhatsAppFab />
      </AuthProvider>
    </MinimalStoreProvider>
  ) : (
    <StoreProvider initialRemoteProducts={initialRemoteProducts}>
      <AuthProvider>
        {children}
        <ConditionalWhatsAppFab />
      </AuthProvider>
    </StoreProvider>
  );

  return (
    <ThemeProvider>
      <LocaleProvider>{storeTree}</LocaleProvider>
    </ThemeProvider>
  );
}
