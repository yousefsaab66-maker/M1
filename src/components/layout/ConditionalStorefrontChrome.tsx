"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

/** Staff routes skip public chrome to reduce SSR/hydration work (CF 1102). */
export function ConditionalStorefrontChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isStaff = pathname.startsWith("/staff");

  if (isStaff) {
    return <main className="site-main flex w-full min-w-0 min-h-0 flex-1 flex-col">{children}</main>;
  }

  return (
    <>
      <Header />
      <main className="site-main flex w-full min-w-0 min-h-0 flex-1 flex-col">{children}</main>
      <Footer />
    </>
  );
}
