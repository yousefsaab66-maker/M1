import { NextResponse } from "next/server";

/** Product videos must use `POST /api/staff/upload-media` with `kind=product` (Cloudflare R2). */
export async function POST() {
  return NextResponse.json({ ok: false, error: "r2_only" }, { status: 410 });
}
