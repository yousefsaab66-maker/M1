import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Collection, SiteContent } from "@/lib/catalog";
import { NO_STORE_JSON_HEADERS } from "@/lib/api-cache-headers";
import { upsertStorefront } from "@/lib/storefront-query";
import { STAFF_COOKIE_NAME, verifyStaffSession } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

async function requireStaff(): Promise<boolean> {
  const secret = process.env.STAFF_COOKIE_SECRET;
  const jar = await cookies();
  return Boolean(verifyStaffSession(jar.get(STAFF_COOKIE_NAME)?.value, secret));
}

/** Persist site settings and/or collections to R2 (all devices). */
export async function PUT(req: Request) {
  if (!(await requireStaff())) {
    return NextResponse.json({ ok: false, error: "unauthorized" } as const, { status: 401 });
  }

  let body: { site?: SiteContent; collections?: Collection[] };
  try {
    body = (await req.json()) as { site?: SiteContent; collections?: Collection[] };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" } as const, { status: 400 });
  }

  if (!body.site && !body.collections) {
    return NextResponse.json({ ok: false, error: "empty_patch" } as const, { status: 400 });
  }

  const result = await upsertStorefront({
    site: body.site,
    collections: body.collections,
  });

  if (!result.ok) {
    const status =
      result.error === "embedded_media"
        ? 400
        : result.error === "r2_not_configured" || result.error === "r2_write_failed"
          ? 503
          : 500;
    return NextResponse.json({ ok: false, error: result.error } as const, { status });
  }

  return NextResponse.json(
    { ok: true, updatedAt: result.updatedAt } as const,
    {
      headers: {
        ...NO_STORE_JSON_HEADERS,
        "X-Muhra-Cache-Hint": "purge-storefront-after-deploy",
      },
    },
  );
}
