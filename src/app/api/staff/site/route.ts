import { NextRequest, NextResponse } from "next/server";
import type { SiteContent } from "@/lib/catalog";
import { upsertSiteContent } from "@/lib/storefront-query";
import { getStaffUserFromRequest } from "@/lib/staff-auth-request";
import { STAFF_CORS_HEADERS } from "@/lib/staff-cors";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: STAFF_CORS_HEADERS });
}

/** Staff site settings — persisted in Supabase for all visitors/devices. */
export async function PUT(req: NextRequest) {
  const staff = await getStaffUserFromRequest(req);
  if (!staff) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" } as const,
      { status: 401, headers: STAFF_CORS_HEADERS },
    );
  }

  let payload: SiteContent;
  try {
    payload = (await req.json()) as SiteContent;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" } as const,
      { status: 400, headers: STAFF_CORS_HEADERS },
    );
  }

  const result = await upsertSiteContent(payload);
  if (!result.ok) {
    const status =
      result.error === "embedded_media"
        ? 400
        : result.error === "r2_not_configured" ||
            result.error === "r2_write_failed" ||
            result.error === "backend_not_configured" ||
            result.error === "table_missing"
          ? 503
          : 500;
    return NextResponse.json(
      { ok: false, error: result.error } as const,
      { status, headers: STAFF_CORS_HEADERS },
    );
  }
  return NextResponse.json(
    { ok: true, updatedAt: result.updatedAt } as const,
    { headers: STAFF_CORS_HEADERS },
  );
}
