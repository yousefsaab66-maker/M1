import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { STAFF_COOKIE_NAME, verifyStaffSession } from "@/lib/staff-session";
import {
  buildStaffMediaObjectPath,
  isStaffMediaKind,
  STAFF_WORKER_VIDEO_MAX_BYTES,
  putStaffObject,
  staffImageExt,
  staffVideoExt,
  validateStaffImageMime,
  validateStaffVideoMime,
  type StaffMediaKind,
} from "@/lib/staff-upload-server";

export const dynamic = "force-dynamic";

const IMAGE_LIMIT = 45;
const VIDEO_LIMIT = 12;
const MEDIA_WINDOW_MS = 60 * 60 * 1000;
const MEDIA_WINDOW_SEC = MEDIA_WINDOW_MS / 1000;

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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const kindRaw = typeof formData.get("kind") === "string" ? (formData.get("kind") as string).trim() : "";
  if (!isStaffMediaKind(kindRaw)) {
    return NextResponse.json({ ok: false, error: "invalid_kind" }, { status: 400 });
  }
  const kind = kindRaw;

  const file = formData.get("file");
  if (!file || typeof file === "string" || !("arrayBuffer" in file)) {
    return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
  }

  const videoMime = validateStaffVideoMime(file);
  const imageMime = videoMime ? null : validateStaffImageMime(file);
  const isVideo = Boolean(videoMime);
  const isImage = Boolean(imageMime);

  if (!isVideo && !isImage) {
    return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 });
  }

  const mime = (isVideo ? videoMime : imageMime)!;

  if (kind === "journal" && isVideo) {
    return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 });
  }
  if (kind === "site" && isVideo) {
    return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ ok: false, error: "empty_file" }, { status: 400 });
  }

  const rlKey = isVideo ? `staff_upload_media_vid:${staff}:${ip}` : `staff_upload_media_img:${staff}:${ip}`;
  const rlCap = isVideo ? VIDEO_LIMIT : IMAGE_LIMIT;
  const rl = rateLimit(rlKey, rlCap, MEDIA_WINDOW_MS);
  const rlHeaders = rateLimitHeaders(rl, rlCap, MEDIA_WINDOW_SEC);
  if (isVideo && file.size > STAFF_WORKER_VIDEO_MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "video_too_large" }, { status: 413, headers: rlHeaders });
  }
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfter: rl.retryAfter },
      { status: 429, headers: rlHeaders },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = isVideo ? staffVideoExt(mime) : staffImageExt(mime);
  const objectPath = buildStaffMediaObjectPath(
    kind as StaffMediaKind,
    ext,
    typeof file.name === "string" ? file.name : "media",
  );

  const put = await putStaffObject(objectPath, buf, mime);
  if (!put.ok) {
    const body: { ok: false; error: string; detail?: string } = { ok: false, error: put.error };
    if ("detail" in put && typeof put.detail === "string") body.detail = put.detail;
    return NextResponse.json(body, { status: put.status, headers: rlHeaders });
  }

  return NextResponse.json({ ok: true, url: put.url, path: put.path }, { headers: rlHeaders });
}
