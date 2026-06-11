import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Product } from "@/lib/catalog";
import { NO_STORE_JSON_HEADERS } from "@/lib/api-cache-headers";
import { deleteProductFromSupabase } from "@/lib/muhra-product-delete";
import { upsertProductToSupabase } from "@/lib/muhra-product-upsert";
import { STAFF_COOKIE_NAME, verifyStaffSession } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

async function requireStaff(): Promise<boolean> {
  const secret = process.env.STAFF_COOKIE_SECRET;
  const jar = await cookies();
  return Boolean(verifyStaffSession(jar.get(STAFF_COOKIE_NAME)?.value, secret));
}

/** Staff product save — avoids Next Server Action overhead on Cloudflare Workers (1102). */
export async function POST(req: Request) {
  if (!(await requireStaff())) {
    return NextResponse.json({ ok: false, error: "unauthorized" } as const, {
      status: 401,
      headers: NO_STORE_JSON_HEADERS,
    });
  }

  let payload: Product;
  try {
    payload = (await req.json()) as Product;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" } as const, {
      status: 400,
      headers: NO_STORE_JSON_HEADERS,
    });
  }

  const result = await upsertProductToSupabase(payload);
  return NextResponse.json(result, { headers: NO_STORE_JSON_HEADERS });
}

/** Staff product delete — avoids Next Server Action overhead on Cloudflare Workers (1102). */
export async function DELETE(req: Request) {
  if (!(await requireStaff())) {
    return NextResponse.json({ ok: false, error: "unauthorized" } as const, {
      status: 401,
      headers: NO_STORE_JSON_HEADERS,
    });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing_id" } as const, {
      status: 400,
      headers: NO_STORE_JSON_HEADERS,
    });
  }

  const result = await deleteProductFromSupabase(id);
  if (!result.ok) {
    const status =
      result.error === "not_configured"
        ? 503
        : result.error === "invalid_id" || result.error === "not_found"
          ? 400
          : 500;
    return NextResponse.json({ ok: false, error: result.error } as const, {
      status,
      headers: NO_STORE_JSON_HEADERS,
    });
  }
  return NextResponse.json({ ok: true } as const, { headers: NO_STORE_JSON_HEADERS });
}
