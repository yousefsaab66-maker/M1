/**
 * Pre-render storefront pages at build time so HTML is served from `.open-next/assets`
 * when `run_worker_first` is false — avoids Error 1102 (Worker CPU limits).
 */
export { staticPageDynamic as dynamic } from "@/lib/static-page";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return children;
}
