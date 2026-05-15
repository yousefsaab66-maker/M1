/** Prepare staff image uploads: normalize MIME, downscale huge photos, always JPEG for R2. */
const MAX_EDGE = 2400;
const JPEG_QUALITY = 0.88;

function mimeFromName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  if (/\.jpe?g$/.test(lower)) return "image/jpeg";
  return null;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode_failed"));
    };
    img.src = url;
  });
}

/** Downscale and re-encode as JPEG so Worker upload stays small and URLs work everywhere. */
export async function prepareStaffImageForUpload(file: File): Promise<File> {
  const hinted = (file.type || mimeFromName(file.name) || "").trim().toLowerCase();
  if (!hinted.startsWith("image/")) {
    throw new Error("not_image");
  }

  if (hinted === "image/gif") {
    return file.size > 0 ? file : Promise.reject(new Error("empty"));
  }

  try {
    const img = await loadImageFromFile(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height, 1));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY);
    });
    if (!blob || blob.size === 0) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    if (hinted === "image/jpeg" || hinted === "image/png" || hinted === "image/webp") {
      return file;
    }
    throw new Error("decode_failed");
  }
}
