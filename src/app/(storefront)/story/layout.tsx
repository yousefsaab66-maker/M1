import type { Metadata } from "next";
import { staticPageMetadata } from "@/lib/seo-metadata";

export { staticPageDynamic as dynamic } from "@/lib/static-page";

export const metadata: Metadata = staticPageMetadata("/story");

export default function StoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
