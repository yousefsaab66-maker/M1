import dynamic from "next/dynamic";

/** Avoid SSR of ~2k-line staff bundle — keeps /staff HTML render under CF Worker limits (1102). */
const StaffPageClient = dynamic(() => import("./StaffPageClient"), {
  ssr: false,
  loading: () => (
    <div className="px-6 py-32 text-center opacity-70" aria-busy="true">
      …
    </div>
  ),
});

export default function StaffPage() {
  return <StaffPageClient />;
}
