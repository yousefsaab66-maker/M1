import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getMuhraMediaR2Binding, uploadStaffBlobToR2 } from "@/lib/r2-upload";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { STAFF_COOKIE_NAME, verifyStaffSession } from "@/lib/staff-session";
import {
  buildR2PublicObjectUrl,
  MUHRA_MAX_IMAGE_UPLOAD_BYTES,
  isAllowedStaffImageMime,
  sanitizeStorageFileName,
} from "@/lib/supabase/storage-constants";

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

  const r2Bucket = await getMuhraMediaR2Binding();
  const r2PublicBase = process.env.R2_PUBLIC_BASE_URL?.trim();
  const useR2 = Boolean(r2Bucket && r2PublicBase);

  if (!useR2) {
    const err = r2Bucket && !r2PublicBase ? "r2_public_base_missing" : "r2_media_required";
    return NextResponse.json({ ok: false, error: err }, { status: 503, headers: rlHeaders });
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

  const mime = (file.type || "application/octet-stream").trim().toLowerCase();
  if (!isAllowedStaffImageMime(mime)) {
    return NextResponse.json(
      { ok: false, error: "invalid_type" },
      { status: 400, headers: rlHeaders },
    );
  }

  const size = file.size;
  if (size <= 0 || size > MUHRA_MAX_IMAGE_UPLOAD_BYTES) {
    return NextResponse.json(
      { ok: false, error: "too_large" },
      { status: 400, headers: rlHeaders },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());

  const baseName = sanitizeStorageFileName(typeof file.name === "string" ? file.name : "image");
  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/webp"
        ? "webp"
        : mime === "image/gif"
          ? "gif"
          : "jpg";
  const scopeRaw = typeof formData.get("scope") === "string" ? (formData.get("scope") as string).trim() : "";
  const scope = scopeRaw === "site" ? "site" : "products";
  const slug = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const objectPath = `${scope}/${slug}-${baseName.replace(/\.[^.]+$/, "")}.${ext}`;

  try {
    await uploadStaffBlobToR2(r2Bucket!, objectPath, buf, mime);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: "r2_upload_failed", detail },
      { status: 502, headers: rlHeaders },
    );
  }
  const url = buildR2PublicObjectUrl(r2PublicBase!, objectPath);
  return NextResponse.json({ ok: true, url, path: objectPath }, { headers: rlHeaders });
}
