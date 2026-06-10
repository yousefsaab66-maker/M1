import type { Metadata } from "next";
import { NOINDEX_ROBOTS } from "@/lib/seo-metadata";
export { staticPageDynamic as dynamic } from "@/lib/static-page";

export const metadata: Metadata = {
  title: "Admin — MUHRA JEWELRY",
  robots: NOINDEX_ROBOTS,
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
