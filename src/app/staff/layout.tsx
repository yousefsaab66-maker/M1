import type { Metadata } from "next";
import { NOINDEX_ROBOTS } from "@/lib/seo-metadata";
import StaffClientLayout from "./StaffClientLayout";

export const metadata: Metadata = {
  title: "Staff — MUHRA JEWELRY",
  robots: NOINDEX_ROBOTS,
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffClientLayout>{children}</StaffClientLayout>;
}
