import { getR2StaffContext } from "@/lib/r2-staff-context";
import { uploadStaffBlobToR2 } from "@/lib/r2-upload";
import {
  buildR2PublicObjectUrl,
  staffImageMimeFromFile,
  isAllowedStaffImageMime,
  isAllowedStaffVideoMime,
  staffVideoMimeFromFile,
} from "@/lib/supabase/storage-constants";

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
