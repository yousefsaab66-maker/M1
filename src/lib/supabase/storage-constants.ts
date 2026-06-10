/**
 * Staff media uploads use **direct browser → R2** presigned PUT (`POST /api/staff/upload-url`)
 * when `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` are set on the Worker.
 * That bypasses the Cloudflare Worker HTTP body limit (~100 MB on Free/Pro).
 *
 * **No app-level file-size cap** — MIME type is validated; empty files are rejected.
 * Remaining limit is R2 bucket/object size (multi‑TB per object on paid plans).
 *
 * Without presign secrets, uploads fall back to Worker proxy (`/api/staff/upload*`) and inherit
 * edge body limits. Apply CORS with PUT: `npx wrangler r2 bucket cors put muhra-media --file scripts/r2-cors.json`
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
