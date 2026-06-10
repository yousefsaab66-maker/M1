import type { Metadata } from "next";
import { NOINDEX_ROBOTS } from "@/lib/seo-metadata";

/** Static HTML shell — session check client-side only (avoids CF Worker 1102 on reload). */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Staff Login — MUHRA JEWELRY",
  robots: NOINDEX_ROBOTS,
};

export default function StaffLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
