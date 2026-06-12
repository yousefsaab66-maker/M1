/** Max edge length for staff product/site image uploads (browser resize before R2 PUT). */
const MAX_UPLOAD_EDGE_PX = 1600;
const UPLOAD_JPEG_QUALITY = 0.85;
/** Skip re-encoding when already small enough (saves CPU on staff devices). */
const SKIP_REENCODE_MAX_BYTES = 500 * 1024;

function mimeFromName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  if (/\.jpe?g$/.test(lower)) return "image/jpeg";
  return null;
}

function outputName(stem: string, ext: string): string {
  const base = stem.replace(/\.[^.]+$/, "").replace(/^.*[/\\]/, "") || "image";
  return `${base}.${ext}`;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("blob_failed"))),
      type,
      quality,
    );
  });
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode_failed"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(img, 0, 0);
    return createImageBitmap(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function pickOutputFormat(
  canvas: HTMLCanvasElement,
  hinted: string,
  originalSize: number,
): Promise<{ mime: string; ext: string; quality?: number }> {
  const webpBlob = await canvasToBlob(canvas, "image/webp", UPLOAD_JPEG_QUALITY);
  if (webpBlob.size < originalSize * 0.92) {
    return { mime: "image/webp", ext: "webp", quality: UPLOAD_JPEG_QUALITY };
  }
  if (hinted === "image/png") {
    const pngBlob = await canvasToBlob(canvas, "image/png");
    if (pngBlob.size < originalSize) {
      return { mime: "image/png", ext: "png" };
    }
  }
  return { mime: "image/jpeg", ext: "jpg", quality: UPLOAD_JPEG_QUALITY };
}

/**
 * Resize/compress staff images in the browser before presigned R2 PUT.
 * Keeps GIF animation intact; HEIC without decode support still fails with decode_failed.
 */
export async function prepareStaffImageForUpload(file: File): Promise<File> {
  const hinted = (file.type || mimeFromName(file.name) || "").trim().toLowerCase();
  if (!hinted.startsWith("image/")) {
    throw new Error("not_image");
  }
  if (file.size <= 0) {
    throw new Error("empty");
  }
  if (hinted === "image/gif") {
    return file;
  }
  if (hinted === "image/heic" || hinted === "image/heif") {
    throw new Error("decode_failed");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await loadBitmap(file);
  } catch {
    throw new Error("decode_failed");
  }

  const maxEdge = Math.max(bitmap.width, bitmap.height);
  if (maxEdge <= MAX_UPLOAD_EDGE_PX && file.size <= SKIP_REENCODE_MAX_BYTES) {
    bitmap.close();
    return file;
  }

  const scale = Math.min(1, MAX_UPLOAD_EDGE_PX / maxEdge);
  const outW = Math.max(1, Math.round(bitmap.width * scale));
  const outH = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("decode_failed");
  }
  ctx.drawImage(bitmap, 0, 0, outW, outH);
  bitmap.close();

  const { mime, ext, quality } = await pickOutputFormat(canvas, hinted, file.size);
  const blob = await canvasToBlob(canvas, mime, quality);
  const stem = file.name || "image";
  return new File([blob], outputName(stem, ext), { type: mime, lastModified: Date.now() });
}
