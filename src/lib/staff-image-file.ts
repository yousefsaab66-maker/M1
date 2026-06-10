function mimeFromName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  if (/\.jpe?g$/.test(lower)) return "image/jpeg";
  return null;
}

/** Validate staff image uploads; pass the original file through (no size cap or downscaling). */
export async function prepareStaffImageForUpload(file: File): Promise<File> {
  const hinted = (file.type || mimeFromName(file.name) || "").trim().toLowerCase();
  if (!hinted.startsWith("image/")) {
    throw new Error("not_image");
  }
  if (file.size <= 0) {
    throw new Error("empty");
  }
  return file;
}
