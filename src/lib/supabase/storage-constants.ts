/** Bucket for staff-uploaded catalogue images — create via Supabase migration or dashboard. */
export const MUHRA_PRODUCT_IMAGES_BUCKET =
  typeof process.env.SUPABASE_STORAGE_BUCKET === "string" && process.env.SUPABASE_STORAGE_BUCKET.length > 0
    ? process.env.SUPABASE_STORAGE_BUCKET.trim()
    : "muhra-products";

/** يطابق `file_size_limit` لـ bucket `muhra-products` في Supabase (انظر migrations). */
export const MUHRA_MAX_IMAGE_UPLOAD_BYTES = 25 * 1024 * 1024;

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

export function sanitizeStorageFileName(original: string): string {
  const base = original.replace(/^.*[/\\]/, "").replace(/[^\w.-]+/g, "-");
  const cleaned = base.replace(/^-+|-+$/g, "").slice(0, 120);
  return cleaned.length > 0 ? cleaned : "image";
}

/** Map Supabase Storage errors to stable i18n keys (`staff.images.uploadErr.*`). */
export function mapSupabaseStorageUploadError(raw: string): string {
  const m = (raw || "").toLowerCase();
  if (!m.trim()) return "storage_generic";
  if (m.includes("bucket") && m.includes("not found")) return "bucket_missing";
  if (m.includes("row-level security") || m.includes("rls") || m.includes("violates row-level")) return "rls_denied";
  if (m.includes("already exists")) return "duplicate_object";
  if (m.includes("mime") || m.includes("content type") || m.includes("not allowed"))
    return "mime_not_allowed";
  if (m.includes("payload too large") || m.includes("entity too large") || m.includes("request entity too large"))
    return "too_large";
  if (m.includes("jwt") || m.includes("invalid api") || m.includes("invalid token") || m.includes("signature"))
    return "bad_credentials";
  return "storage_generic";
}
