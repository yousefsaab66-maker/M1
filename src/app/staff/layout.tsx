import type { Metadata } from "next";
import { NOINDEX_ROBOTS } from "@/lib/seo-metadata";
import StaffClientLayout from "./StaffClientLayout";

export {
  staticPageDynamic as dynamic,
  staticPageRevalidate as revalidate,
} from "@/lib/static-page";

/** Static HTML shell — catalog/site load client-side via `/api/staff/bootstrap` (avoids CF Worker 1102 on refresh). */

export const metadata: Metadata = {
  title: "Staff — MUHRA JEWELRY",
  robots: NOINDEX_ROBOTS,
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffClientLayout>{children}</StaffClientLayout>;
}
