import { getR2StaffContext } from "@/lib/r2-staff-context";
import { createR2PresignedPutUrl, isR2PresignConfigured } from "@/lib/r2-presign";
import { uploadStaffBlobToR2 } from "@/lib/r2-upload";
import {
  buildR2PublicObjectUrl,
  R2_PRESIGNED_PUT_CACHE_CONTROL,
  sanitizeStorageFileName,
  staffImageMimeFromFile,
  isAllowedStaffImageMime,
  isAllowedStaffVideoMime,
  staffVideoMimeFromFile,
} from "@/lib/supabase/storage-constants";

export type StaffImageScope = "site" | "collections" | "products";
export type StaffMediaKind = "hero" | "journal" | "product" | "site";

const MEDIA_KINDS = ["hero", "journal", "product", "site"] as const;

export function isStaffMediaKind(s: string): s is StaffMediaKind {
  return (MEDIA_KINDS as readonly string[]).includes(s);
}

function scopePrefix(scope: StaffImageScope): string {
  if (scope === "collections") return "site/collections";
  if (scope === "site") return "site";
  return "products";
}

function objectPrefixForKind(kind: StaffMediaKind): string {
  if (kind === "hero") return "hero";
  if (kind === "journal") return "journal";
  if (kind === "site") return "site";
  return "products";
}

function randomSlug(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildStaffImageObjectPath(scope: StaffImageScope, ext: string): string {
  return `${scopePrefix(scope)}/${randomSlug()}.${ext}`;
}

export function buildStaffMediaObjectPath(
  kind: StaffMediaKind,
  ext: string,
  originalName: string,
): string {
  const baseName = sanitizeStorageFileName(originalName || "media");
  const stem = baseName.replace(/\.[^.]+$/, "");
  return `${objectPrefixForKind(kind)}/${randomSlug()}-${stem}.${ext}`;
}

export type StaffDirectUploadIntent =
  | { mode: "image"; scope: StaffImageScope; mime: string }
  | { mode: "media"; kind: StaffMediaKind; mime: string; fileName: string; isVideo: boolean };

export function buildStaffObjectPath(intent: StaffDirectUploadIntent): string | null {
  if (intent.mode === "image") {
    if (!isAllowedStaffImageMime(intent.mime)) return null;
    return buildStaffImageObjectPath(intent.scope, staffImageExt(intent.mime));
  }
  if (!intent.isVideo && !isAllowedStaffImageMime(intent.mime)) return null;
  if (intent.isVideo && !isAllowedStaffVideoMime(intent.mime)) return null;
  const ext = intent.isVideo ? staffVideoExt(intent.mime) : staffImageExt(intent.mime);
  return buildStaffMediaObjectPath(intent.kind, ext, intent.fileName);
}

export type StaffDirectUploadResult =
  | {
      ok: true;
      uploadUrl: string;
      url: string;
      path: string;
      contentType: string;
      cacheControl: string;
    }
  | { ok: false; error: string; status: number };

/** Issue a presigned PUT URL for browser → R2 direct upload. */
export async function createStaffDirectUpload(
  intent: StaffDirectUploadIntent,
): Promise<StaffDirectUploadResult> {
  if (!isR2PresignConfigured()) {
    return { ok: false, error: "r2_presign_not_configured", status: 503 };
  }

  const ctx = await getR2StaffContext();
  if (!ctx.ready) {
    return { ok: false, error: ctx.error, status: 503 };
  }

  const objectPath = buildStaffObjectPath(intent);
  if (!objectPath) {
    return { ok: false, error: "invalid_type", status: 400 };
  }

  if (intent.mode === "media") {
    if (intent.kind === "journal" && intent.isVideo) {
      return { ok: false, error: "invalid_type", status: 400 };
    }
    if (intent.kind === "site" && intent.isVideo) {
      return { ok: false, error: "invalid_type", status: 400 };
    }
  }

  const uploadUrl = await createR2PresignedPutUrl(objectPath, intent.mime);
  if (!uploadUrl) {
    return { ok: false, error: "r2_presign_not_configured", status: 503 };
  }

  const url = buildR2PublicObjectUrl(ctx.publicBase, objectPath);
  return {
    ok: true,
    uploadUrl,
    url,
    path: objectPath,
    contentType: intent.mime,
    cacheControl: R2_PRESIGNED_PUT_CACHE_CONTROL,
  };
}

export function staffImageExt(mime: string): string {
  const m = mime.trim().toLowerCase();
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  return "jpg";
}

export function staffVideoExt(mime: string): string {
  const m = mime.trim().toLowerCase();
  if (m === "video/webm") return "webm";
  if (m === "video/quicktime") return "mov";
  return "mp4";
}

export function normalizeStaffImageMime(file: { type?: string; name?: string }): string {
  let mime = staffImageMimeFromFile(file);
  if (mime === "image/heic" || mime === "image/heif") mime = "image/jpeg";
  return mime;
}

export type PutStaffObjectResult =
  | { ok: true; url: string; path: string }
  | { ok: false; error: string; status: number; detail?: string };

export async function putStaffObject(
  objectPath: string,
  buf: Buffer,
  mime: string,
): Promise<PutStaffObjectResult> {
  const ctx = await getR2StaffContext();
  if (!ctx.ready) {
    return { ok: false, error: ctx.error, status: 503 };
  }

  try {
    await uploadStaffBlobToR2(ctx.bucket, objectPath, buf, mime);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, error: "r2_upload_failed", status: 502, detail };
  }

  const url = buildR2PublicObjectUrl(ctx.publicBase, objectPath);
  return { ok: true, url, path: objectPath };
}

export function validateStaffImageMime(file: { type?: string; name?: string }): string | null {
  const mime = normalizeStaffImageMime(file);
  return isAllowedStaffImageMime(mime) ? mime : null;
}

export function validateStaffVideoMime(file: { type?: string; name?: string }): string | null {
  const mime = staffVideoMimeFromFile(file);
  return isAllowedStaffVideoMime(mime) ? mime : null;
}
