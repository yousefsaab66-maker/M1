"use client";

import nextDynamic from "next/dynamic";

/** Avoid SSR of login bundle — keeps /staff/login HTML render under CF Worker limits (1102). */
const StaffLoginPageClient = nextDynamic(() => import("./StaffLoginPageClient"), {
  ssr: false,
  loading: () => (
    <div className="px-6 py-32 text-center opacity-70" aria-busy="true">
      …
    </div>
  ),
});

export default function StaffLoginPageDynamic() {
  return <StaffLoginPageClient />;
}
