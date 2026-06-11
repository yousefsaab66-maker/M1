import { NextResponse } from "next/server";
import { NO_STORE_JSON_HEADERS } from "@/lib/api-cache-headers";
import { purgeCloudflareCatalogCache } from "@/lib/cloudflare-purge";
import { refreshStorefrontCatalogInR2 } from "@/lib/storefront-r2";
import { isStaffAuthorized } from "@/lib/staff-sync-auth";

export const dynamic = "force-dynamic";

/**
 * One-shot R2 catalog patch from Supabase — removes ghost CDN products (e.g. deleted "يسيس").
 * Purges catalog + storefront.json CDN URLs async (never purge_everything).
 */
export async function POST(request: Request) {
  if (!(await isStaffAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "unauthorized" } as const, {
      status: 401,
      headers: NO_STORE_JSON_HEADERS,
    });
  }

  const result = await refreshStorefrontCatalogInR2();
  if (!result.ok) {
    const status =
      result.error === "r2_not_configured" || result.error === "not_configured" ? 503 : 500;
    return NextResponse.json({ ok: false, error: result.error } as const, {
      status,
      headers: NO_STORE_JSON_HEADERS,
    });
  }

  void purgeCloudflareCatalogCache().catch(() => {});

  return NextResponse.json(
    { ok: true, catalogUpdatedAt: result.catalogUpdatedAt } as const,
    { headers: NO_STORE_JSON_HEADERS },
  );
}
