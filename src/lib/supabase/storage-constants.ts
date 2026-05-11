/** Bucket for staff-uploaded catalogue images — create via Supabase migration or dashboard. */
export const MUHRA_PRODUCT_IMAGES_BUCKET =
  typeof process.env.SUPABASE_STORAGE_BUCKET === "string" && process.env.SUPABASE_STORAGE_BUCKET.length > 0
    ? process.env.SUPABASE_STORAGE_BUCKET.trim()
    : "muhra-products";

/** يطابق `file_size_limit` لـ bucket `muhra-products` في Supabase (انظر migrations). */
export const MUHRA_MAX_IMAGE_UPLOAD_BYTES = Math.floor(2.5 * 1024 * 1024);

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
