import { NextResponse } from "next/server";

/** Product videos: direct R2 via `POST /api/staff/upload-url` + PUT, or legacy `POST /api/staff/upload-media`. */
export async function POST() {
  return NextResponse.json({ ok: false, error: "r2_only" }, { status: 410 });
}
