import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { STAFF_COOKIE_NAME, verifyStaffSession } from "@/lib/staff-session";
import {
  createStaffDirectUpload,
  isStaffMediaKind,
  normalizeStaffImageMime,
  type StaffImageScope,
  validateStaffImageMime,
  validateStaffVideoMime,
} from "@/lib/staff-upload-server";

export const dynamic = "force-dynamic";

const URL_LIMIT = 120;
const URL_WINDOW_MS = 60 * 60 * 1000;
const URL_WINDOW_SEC = URL_WINDOW_MS / 1000;

async function requireStaff(): Promise<string | null> {
  const secret = process.env.STAFF_COOKIE_SECRET;
  const jar = await cookies();
  return verifyStaffSession(jar.get(STAFF_COOKIE_NAME)?.value, secret);
}

function isImageScope(s: string): s is StaffImageScope {
  return s === "site" || s === "collections" || s === "products";
}

type UploadUrlBody = {
  mime?: string;
  fileName?: string;
  scope?: string;
  kind?: string;
};

export async function POST(req: Request) {
  const staff = await requireStaff();
  if (!staff) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(req.headers);
  const rl = rateLimit(`staff_upload_url:${staff}:${ip}`, URL_LIMIT, URL_WINDOW_MS);
  const rlHeaders = rateLimitHeaders(rl, URL_LIMIT, URL_WINDOW_SEC);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfter: rl.retryAfter },
      { status: 429, headers: rlHeaders },
    );
  }

  let body: UploadUrlBody;
  try {
    body = (await req.json()) as UploadUrlBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400, headers: rlHeaders });
  }

  const mimeRaw = typeof body.mime === "string" ? body.mime.trim() : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "media";
  const scopeRaw = typeof body.scope === "string" ? body.scope.trim() : "";
  const kindRaw = typeof body.kind === "string" ? body.kind.trim() : "";

  const hasKind = kindRaw.length > 0;
  const hasScope = scopeRaw.length > 0;

  if (hasKind && hasScope) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400, headers: rlHeaders });
  }
  if (!hasKind && !hasScope) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400, headers: rlHeaders });
  }

  if (hasKind) {
    if (!isStaffMediaKind(kindRaw)) {
      return NextResponse.json({ ok: false, error: "invalid_kind" }, { status: 400, headers: rlHeaders });
    }

    const videoMime = validateStaffVideoMime({ type: mimeRaw, name: fileName });
    const imageMime = videoMime ? null : validateStaffImageMime({ type: mimeRaw, name: fileName });
    const isVideo = Boolean(videoMime);
    const isImage = Boolean(imageMime);
    if (!isVideo && !isImage) {
      return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400, headers: rlHeaders });
    }

    const mime = (isVideo ? videoMime : imageMime)!;
    const direct = await createStaffDirectUpload({
      mode: "media",
      kind: kindRaw,
      mime,
      fileName,
      isVideo,
    });
    if (!direct.ok) {
      return NextResponse.json({ ok: false, error: direct.error }, { status: direct.status, headers: rlHeaders });
    }
    return NextResponse.json(
      {
        ok: true,
        uploadUrl: direct.uploadUrl,
        url: direct.url,
        path: direct.path,
        contentType: direct.contentType,
      },
      { headers: rlHeaders },
    );
  }

  if (!isImageScope(scopeRaw)) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400, headers: rlHeaders });
  }

  const mime = normalizeStaffImageMime({ type: mimeRaw, name: fileName });
  if (!validateStaffImageMime({ type: mime, name: fileName })) {
    return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400, headers: rlHeaders });
  }

  const direct = await createStaffDirectUpload({
    mode: "image",
    scope: scopeRaw,
    mime,
  });
  if (!direct.ok) {
    return NextResponse.json({ ok: false, error: direct.error }, { status: direct.status, headers: rlHeaders });
  }

  return NextResponse.json(
    {
      ok: true,
      uploadUrl: direct.uploadUrl,
      url: direct.url,
      path: direct.path,
      contentType: direct.contentType,
    },
    { headers: rlHeaders },
  );
}
