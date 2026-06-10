import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { STAFF_COOKIE_NAME, verifyStaffSession } from "@/lib/staff-session";
import {
  buildStaffImageObjectPath,
  putStaffObject,
  staffImageExt,
  validateStaffImageMime,
  type StaffImageScope,
} from "@/lib/staff-upload-server";

export const dynamic = "force-dynamic";

const UPLOAD_LIMIT = 60;
const UPLOAD_WINDOW_MS = 60 * 60 * 1000;
const UPLOAD_WINDOW_SEC = UPLOAD_WINDOW_MS / 1000;

async function requireStaff(): Promise<string | null> {
  const secret = process.env.STAFF_COOKIE_SECRET;
  const jar = await cookies();
  return verifyStaffSession(jar.get(STAFF_COOKIE_NAME)?.value, secret);
}

export async function POST(req: Request) {
  const staff = await requireStaff();
  if (!staff) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(req.headers);
  const rl = rateLimit(`staff_upload:${staff}:${ip}`, UPLOAD_LIMIT, UPLOAD_WINDOW_MS);
  const rlHeaders = rateLimitHeaders(rl, UPLOAD_LIMIT, UPLOAD_WINDOW_SEC);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfter: rl.retryAfter },
      { status: 429, headers: rlHeaders },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400, headers: rlHeaders },
    );
  }

  const file = formData.get("file");
  if (!file || typeof file === "string" || !("arrayBuffer" in file)) {
    return NextResponse.json(
      { ok: false, error: "missing_file" },
      { status: 400, headers: rlHeaders },
    );
  }

  const mime = validateStaffImageMime(file);
  if (!mime) {
    return NextResponse.json(
      { ok: false, error: "invalid_type" },
      { status: 400, headers: rlHeaders },
    );
  }

  if (file.size <= 0) {
    return NextResponse.json(
      { ok: false, error: "empty_file" },
      { status: 400, headers: rlHeaders },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = staffImageExt(mime);
  const scopeRaw = typeof formData.get("scope") === "string" ? (formData.get("scope") as string).trim() : "";
  const scope: StaffImageScope =
    scopeRaw === "collections" ? "collections" : scopeRaw === "site" ? "site" : "products";
  const objectPath = buildStaffImageObjectPath(scope, ext);

  const put = await putStaffObject(objectPath, buf, mime);
  if (!put.ok) {
    const body: { ok: false; error: string; detail?: string } = { ok: false, error: put.error };
    if ("detail" in put && typeof put.detail === "string") body.detail = put.detail;
    return NextResponse.json(body, { status: put.status, headers: rlHeaders });
  }

  return NextResponse.json({ ok: true, url: put.url, path: put.path }, { headers: rlHeaders });
}
