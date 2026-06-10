import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { NO_STORE_JSON_HEADERS } from "@/lib/api-cache-headers";
import { purgeCloudflareCatalogCache, purgeCloudflareStorefrontCache } from "@/lib/cloudflare-purge";
import { STAFF_COOKIE_NAME, verifyStaffSession } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

async function requireStaff(): Promise<boolean> {
  const secret = process.env.STAFF_COOKIE_SECRET;
  const jar = await cookies();
  return Boolean(verifyStaffSession(jar.get(STAFF_COOKIE_NAME)?.value, secret));
}

/** Optional targeted purge when CLOUDFLARE_* env vars are configured. Never purge_everything. */
export async function POST(req: Request) {
  if (!(await requireStaff())) {
    return NextResponse.json({ ok: false, error: "unauthorized" } as const, {
      status: 401,
      headers: NO_STORE_JSON_HEADERS,
    });
  }

  const scope = new URL(req.url).searchParams.get("scope")?.trim();
  /* Fire-and-forget — never block staff save on Cloudflare API (CF 1102). */
  if (scope === "catalog") {
    void purgeCloudflareCatalogCache().catch(() => {});
  } else if (scope === "storefront") {
    void purgeCloudflareStorefrontCache().catch(() => {});
  }

  return NextResponse.json({ ok: true, purged: scope === "catalog" || scope === "storefront" } as const, {
    headers: NO_STORE_JSON_HEADERS,
  });
}
