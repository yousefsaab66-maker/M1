import type { Metadata } from "next";
import { NOINDEX_ROBOTS } from "@/lib/seo-metadata";

/** Avoid a cached static shell with an empty client main on /staff/login. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staff Login — MUHRA JEWELRY",
  robots: NOINDEX_ROBOTS,
};

export default function StaffLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
