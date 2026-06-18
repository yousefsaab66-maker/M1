/**
 * Staff media uploads use **presigned browser → R2 PUT** first (`POST /api/staff/upload-url`)
 * for all images and videos (any size). Worker binding (`/api/staff/upload*`) is fallback only.
 *
 * **Production (unlimited):** set Worker secrets `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
 * `R2_SECRET_ACCESS_KEY`, then apply bucket CORS:
 * `npm run r2:cors`
 *
 * **No app-level file-size cap** — MIME type is validated; empty files are rejected.
 * Worker cannot hold multi-GB bodies; presign + CORS is required for large files.
 */

/** Must match `PutObjectCommand.CacheControl` in r2-presign.ts — browser PUT must send this header. */
export const R2_PRESIGNED_PUT_CACHE_CONTROL = "public, max-age=31536000, immutable" as const;

/** Worker proxy upload practical max (below Cloudflare ~100 MB; large buffers often fail earlier). */
export const STAFF_WORKER_PROXY_MAX_BYTES = 48 * 1024 * 1024;

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
