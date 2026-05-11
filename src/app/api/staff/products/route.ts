import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Product } from "@/lib/catalog";
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
    return NextResponse.json({ ok: false, error: "unauthorized" } as const, { status: 401 });
  }

  let payload: Product;
  try {
    payload = (await req.json()) as Product;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" } as const, { status: 400 });
  }

  const result = await upsertProductToSupabase(payload);
  return NextResponse.json(result);
}
