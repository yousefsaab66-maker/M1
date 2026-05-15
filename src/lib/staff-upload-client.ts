"use client";

import { prepareStaffImageForUpload } from "@/lib/staff-image-file";
import { normalizeStaffMediaUrl } from "@/lib/staff-media-url";

export type StaffUploadResult = { ok: true; url: string } | { ok: false; code: string };

const RETRY_STATUSES = new Set([429, 502, 503, 524]);

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function parseUploadBody(res: Response): Promise<{ ok?: boolean; url?: string; error?: string }> {
  return (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
}

function resultFromResponse(
  res: Response,
  body: { ok?: boolean; url?: string; error?: string },
): StaffUploadResult {
  if (res.status === 401 || body.error === "unauthorized") return { ok: false, code: "unauthorized" };
  if (res.ok && body.ok && typeof body.url === "string") {
    return { ok: true, url: normalizeStaffMediaUrl(body.url) };
  }
  const code = typeof body.error === "string" && body.error.length > 0 ? body.error : "unknown";
  return { ok: false, code };
}

/** Product / site / collection images → `POST /api/staff/upload` (JPEG after client prep). */
export async function uploadStaffImageFile(
  file: File,
  scope: "site" | "collections" | "products" = "products",
  opts?: { onSuccess?: () => void; signal?: AbortSignal },
): Promise<StaffUploadResult> {
  let prepared: File;
  try {
    prepared = await prepareStaffImageForUpload(file);
  } catch {
    return { ok: false, code: "decode_failed" };
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (opts?.signal?.aborted) return { ok: false, code: "aborted" };
    const fd = new FormData();
    fd.append("file", prepared);
    fd.append("scope", scope);

    let res: Response;
    try {
      res = await fetch("/api/staff/upload", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
        cache: "no-store",
        signal: opts?.signal,
      });
    } catch {
      if (opts?.signal?.aborted) return { ok: false, code: "aborted" };
      if (attempt < 2) {
        await delay(500 * (attempt + 1));
        continue;
      }
      return { ok: false, code: "network" };
    }

    const body = await parseUploadBody(res);
    const out = resultFromResponse(res, body);
    if (out.ok) {
      opts?.onSuccess?.();
      return out;
    }
    if (!RETRY_STATUSES.has(res.status) || attempt >= 2) return out;
    await delay(500 * (attempt + 1));
  }

  return { ok: false, code: "unknown" };
}

export type StaffMediaKind = "hero" | "journal" | "product" | "site";

/** Hero video / journal image → `POST /api/staff/upload-media`. */
export async function uploadStaffMediaFile(
  file: File,
  kind: StaffMediaKind,
  opts?: { onSuccess?: () => void },
): Promise<StaffUploadResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);

    let res: Response;
    try {
      res = await fetch("/api/staff/upload-media", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch {
      if (attempt < 2) {
        await delay(500 * (attempt + 1));
        continue;
      }
      return { ok: false, code: "network" };
    }

    const body = await parseUploadBody(res);
    const out = resultFromResponse(res, body);
    if (out.ok) {
      opts?.onSuccess?.();
      return out;
    }
    if (!RETRY_STATUSES.has(res.status) || attempt >= 2) return out;
    await delay(500 * (attempt + 1));
  }

  return { ok: false, code: "unknown" };
}

export function translateStaffUploadError(code: string, t: (key: string) => string): string {
  const key = `staff.images.uploadErr.${code}`;
  const txt = t(key);
  return txt === key ? t("staff.images.uploadErr.unknown") : txt;
}
