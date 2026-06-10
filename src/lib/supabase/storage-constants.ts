/**
 * Staff media uploads (images + video) go through the Worker to R2.
 *
 * **No app-level file-size cap** — MIME type is validated; empty files are rejected.
 *
 * **Cloudflare platform limits** (CDN edge, not configurable in app code):
 * - Free / Pro: ~100 MB max HTTP request body → 413 if exceeded
 * - Business: ~200 MB
 * - Enterprise: ~500 MB default (higher on request)
 * See https://developers.cloudflare.com/workers/platform/limits/#request-and-response-limits
 *
 * Uploads buffer the full body in the Worker before `R2.put`, so very large files also
 * need enough Worker memory/CPU time. For multi‑GB files, use direct-to-R2 presigned
 * multipart uploads (not implemented here).
 */

/** Allowed MIME types for product uploads (staff API + bucket policy alignment). */
export const MUHRA_IMAGE_UPLOAD_MIME: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export function isAllowedStaffImageMime(mime: string): boolean {
  return MUHRA_IMAGE_UPLOAD_MIME.includes(mime.trim().toLowerCase());
}

/** iOS / desktop pickers often send an empty `file.type`; infer from extension. */
export function staffVideoMimeFromFile(file: { type?: string; name?: string }): string {
  const typed = (file.type || "").trim().toLowerCase();
  if (typed && typed !== "application/octet-stream") return typed;
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".mov")) return "video/quicktime";
  if (name.endsWith(".mp4") || name.endsWith(".m4v")) return "video/mp4";
  return typed || "application/octet-stream";
}

export function staffImageMimeFromFile(file: { type?: string; name?: string }): string {
  const typed = (file.type || "").trim().toLowerCase();
  if (typed && typed !== "application/octet-stream") return typed;
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".heic") || name.endsWith(".heif")) return "image/heic";
  if (/\.jpe?g$/.test(name)) return "image/jpeg";
  return typed || "application/octet-stream";
}

/** Allowed MIME types for staff-uploaded site videos (aligned with staff UI `accept`). */
export const MUHRA_VIDEO_UPLOAD_MIME: readonly string[] = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

export function isAllowedStaffVideoMime(mime: string): boolean {
  return MUHRA_VIDEO_UPLOAD_MIME.includes(mime.trim().toLowerCase());
}

export function sanitizeStorageFileName(original: string): string {
  const base = original.replace(/^.*[/\\]/, "").replace(/[^\w.-]+/g, "-");
  const cleaned = base.replace(/^-+|-+$/g, "").slice(0, 120);
  return cleaned.length > 0 ? cleaned : "image";
}

/**
 * Build a public URL for an object under `R2_PUBLIC_BASE_URL` (or custom domain root).
 * Encodes each path segment; preserves trailing structure of the base URL.
 */
export function buildR2PublicObjectUrl(baseUrlTrimmed: string, objectPath: string): string {
  const root = baseUrlTrimmed.replace(/\/?$/, "/");
  const base = new URL(root);
  const rel = objectPath
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return new URL(rel, base).href;
}
