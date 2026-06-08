import type { Metadata } from "next";
import { NOINDEX_ROBOTS } from "@/lib/seo-metadata";

export { staticPageDynamic as dynamic } from "@/lib/static-page";

export const metadata: Metadata = {
  title: "Account — MUHRA JEWELRY",
  robots: NOINDEX_ROBOTS,
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
