import type { Metadata } from "next";
import { NOINDEX_ROBOTS } from "@/lib/seo-metadata";
import StaffClientLayout from "./StaffClientLayout";

/** Staff panel is auth-gated and client-heavy — never cache HTML at the edge. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staff — MUHRA JEWELRY",
  robots: NOINDEX_ROBOTS,
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffClientLayout>{children}</StaffClientLayout>;
}
