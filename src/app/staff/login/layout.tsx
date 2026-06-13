import type { Metadata } from "next";
import { NOINDEX_ROBOTS } from "@/lib/seo-metadata";

import { staticPageDynamic, staticPageRevalidate } from "@/lib/static-page";

/** Static HTML shell — session check client-side only (avoids CF Worker 1102 on reload). */
export const dynamic = staticPageDynamic;
export const revalidate = staticPageRevalidate;

export const metadata: Metadata = {
  title: "Staff Login — MUHRA JEWELRY",
  robots: NOINDEX_ROBOTS,
};

export default function StaffLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
