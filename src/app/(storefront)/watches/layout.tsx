import type { Metadata } from "next";
import { staticPageMetadata } from "@/lib/seo-metadata";

export { staticPageDynamic as dynamic } from "@/lib/static-page";

export const metadata: Metadata = staticPageMetadata("/watches");

export default function WatchesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
