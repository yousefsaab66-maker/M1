import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { STAFF_COOKIE_NAME, verifyStaffSession } from "@/lib/staff-session";
import { finalizeStaffDirectUpload } from "@/lib/staff-upload-server";

export const dynamic = "force-dynamic";

const FINALIZE_LIMIT = 240;
const FINALIZE_WINDOW_MS = 60 * 60 * 1000;
const FINALIZE_WINDOW_SEC = FINALIZE_WINDOW_MS / 1000;

async function requireStaff(): Promise<string | null> {
  const secret = process.env.STAFF_COOKIE_SECRET;
  const jar = await cookies();
  return verifyStaffSession(jar.get(STAFF_COOKIE_NAME)?.value, secret);
}

type FinalizeBody = { path?: string };

export async function POST(req: Request) {
  const staff = await requireStaff();
  if (!staff) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(req.headers);
  const rl = rateLimit(`staff_upload_finalize:${staff}:${ip}`, FINALIZE_LIMIT, FINALIZE_WINDOW_MS);
  const rlHeaders = rateLimitHeaders(rl, FINALIZE_LIMIT, FINALIZE_WINDOW_SEC);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfter: rl.retryAfter },
      { status: 429, headers: rlHeaders },
    );
  }

  let body: FinalizeBody;
  try {
    body = (await req.json()) as FinalizeBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400, headers: rlHeaders });
  }

  const objectPath = typeof body.path === "string" ? body.path.trim() : "";
  if (!objectPath || objectPath.includes("..")) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400, headers: rlHeaders });
  }

  const result = await finalizeStaffDirectUpload(objectPath);
  return NextResponse.json({ ok: result.ok }, { headers: rlHeaders });
}
