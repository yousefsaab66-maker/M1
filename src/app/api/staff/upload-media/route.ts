import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getMuhraMediaR2Binding, uploadStaffBlobToR2 } from "@/lib/r2-upload";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { STAFF_COOKIE_NAME, verifyStaffSession } from "@/lib/staff-session";
import {
  buildR2PublicObjectUrl,
  MUHRA_MAX_IMAGE_UPLOAD_BYTES,
  MUHRA_MAX_STAFF_VIDEO_UPLOAD_BYTES,
  isAllowedStaffImageMime,
  isAllowedStaffVideoMime,
  sanitizeStorageFileName,
} from "@/lib/supabase/storage-constants";

export const dynamic = "force-dynamic";

/** Site media (hero video, journal cover image, …). Product catalogue images use `POST /api/staff/upload`. */
const MEDIA_KINDS = ["hero", "journal", "product"] as const;
type MediaKind = (typeof MEDIA_KINDS)[number];

const IMAGE_LIMIT = 45;
const VIDEO_LIMIT = 12;
const MEDIA_WINDOW_MS = 60 * 60 * 1000;
const MEDIA_WINDOW_SEC = MEDIA_WINDOW_MS / 1000;

async function requireStaff(): Promise<string | null> {
  const secret = process.env.STAFF_COOKIE_SECRET;
  const jar = await cookies();
  return verifyStaffSession(jar.get(STAFF_COOKIE_NAME)?.value, secret);
}

function isMediaKind(s: string): s is MediaKind {
  return (MEDIA_KINDS as readonly string[]).includes(s);
}

function videoExt(mime: string): string {
  const m = mime.trim().toLowerCase();
  if (m === "video/webm") return "webm";
  if (m === "video/quicktime") return "mov";
  return "mp4";
}

function imageExt(mime: string): string {
  const m = mime.trim().toLowerCase();
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  return "jpg";
}

function objectPrefixForKind(kind: MediaKind): string {
  if (kind === "hero") return "hero";
  if (kind === "journal") return "journal";
  return "products";
}

export async function POST(req: Request) {
  const staff = await requireStaff();
  if (!staff) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(req.headers);

  const r2Bucket = await getMuhraMediaR2Binding();
  const r2PublicBase = process.env.R2_PUBLIC_BASE_URL?.trim();
  const useR2 = Boolean(r2Bucket && r2PublicBase);

  if (!useR2) {
    const err = r2Bucket && !r2PublicBase ? "r2_public_base_missing" : "r2_media_required";
    return NextResponse.json({ ok: false, error: err }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const kindRaw = typeof formData.get("kind") === "string" ? (formData.get("kind") as string).trim() : "";
  if (!isMediaKind(kindRaw)) {
    return NextResponse.json({ ok: false, error: "invalid_kind" }, { status: 400 });
  }
  const kind = kindRaw;

  const file = formData.get("file");
  if (!file || typeof file === "string" || !("arrayBuffer" in file)) {
    return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
  }

  const mime = (file.type || "application/octet-stream").trim().toLowerCase();
  const isVideo = isAllowedStaffVideoMime(mime);
  const isImage = isAllowedStaffImageMime(mime);

  if (!isVideo && !isImage) {
    return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 });
  }

  if (kind === "journal" && isVideo) {
    return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 });
  }

  if (kind === "product" && isVideo) {
    return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 });
  }

  const maxBytes = isVideo ? MUHRA_MAX_STAFF_VIDEO_UPLOAD_BYTES : MUHRA_MAX_IMAGE_UPLOAD_BYTES;
  const size = file.size;
  if (size <= 0 || size > maxBytes) {
    const err = isVideo ? "video_too_large" : "too_large";
    return NextResponse.json({ ok: false, error: err }, { status: 400 });
  }

  const rlKey = isVideo ? `staff_upload_media_vid:${staff}:${ip}` : `staff_upload_media_img:${staff}:${ip}`;
  const rlCap = isVideo ? VIDEO_LIMIT : IMAGE_LIMIT;
  const rl = rateLimit(rlKey, rlCap, MEDIA_WINDOW_MS);
  const rlHeaders = rateLimitHeaders(rl, rlCap, MEDIA_WINDOW_SEC);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfter: rl.retryAfter },
      { status: 429, headers: rlHeaders },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const baseName = sanitizeStorageFileName(typeof file.name === "string" ? file.name : "media");
  const slug = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const stem = baseName.replace(/\.[^.]+$/, "");
  const ext = isVideo ? videoExt(mime) : imageExt(mime);
  const prefix = objectPrefixForKind(kind);
  const objectPath = `${prefix}/${slug}-${stem}.${ext}`;

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
