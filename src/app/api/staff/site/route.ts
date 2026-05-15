import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { SiteContent } from "@/lib/catalog";
import { upsertSiteContent } from "@/lib/catalog-site-query";
import { STAFF_COOKIE_NAME, verifyStaffSession } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

async function requireStaff(): Promise<boolean> {
  const secret = process.env.STAFF_COOKIE_SECRET;
  const jar = await cookies();
  return Boolean(verifyStaffSession(jar.get(STAFF_COOKIE_NAME)?.value, secret));
}

/** Staff site settings — persisted in Supabase for all visitors/devices. */
export async function PUT(req: Request) {
  if (!(await requireStaff())) {
    return NextResponse.json({ ok: false, error: "unauthorized" } as const, { status: 401 });
  }

  let payload: SiteContent;
  try {
    payload = (await req.json()) as SiteContent;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" } as const, { status: 400 });
  }

  const result = await upsertSiteContent(payload);
  if (!result.ok) {
    const status = result.error === "backend_not_configured" ? 503 : result.error === "table_missing" ? 503 : 500;
    return NextResponse.json({ ok: false, error: result.error } as const, { status });
  }
  return NextResponse.json({ ok: true } as const);
}
