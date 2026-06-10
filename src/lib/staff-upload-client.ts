"use client";

import { prepareStaffImageForUpload } from "@/lib/staff-image-file";
import { normalizeStaffMediaUrl } from "@/lib/staff-media-url";
import { STAFF_WORKER_VIDEO_MAX_BYTES } from "@/lib/staff-upload-server";
import {
  staffImageMimeFromFile,
  staffVideoMimeFromFile,
} from "@/lib/supabase/storage-constants";

export type StaffUploadResult = { ok: true; url: string } | { ok: false; code: string };

export { STAFF_WORKER_VIDEO_MAX_BYTES };

const RETRY_STATUSES = new Set([429, 502, 503, 524]);
const PRESIGN_FALLBACK_ERRORS = new Set(["r2_presign_not_configured"]);

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

type PresignResponse = {
  ok?: boolean;
  uploadUrl?: string;
  url?: string;
  contentType?: string;
  error?: string;
};

async function requestPresignedUpload(
  payload: Record<string, string>,
  signal?: AbortSignal,
): Promise<PresignResponse & { status: number }> {
  const res = await fetch("/api/staff/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(payload),
    signal,
  });
  const body = (await res.json().catch(() => ({}))) as PresignResponse;
  return { ...body, status: res.status };
}

async function putFileToPresignedUrl(
  uploadUrl: string,
  file: File,
  contentType: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
    signal,
  });
  return res.ok;
}

type PresignOk = { kind: "presign"; uploadUrl: string; publicUrl: string; contentType: string };
type PresignOutcome = PresignOk | StaffUploadResult | "retry" | "fallback";

function isStaffVideoUpload(file: File): boolean {
  return staffVideoMimeFromFile(file).startsWith("video/");
}

function presignErrorShouldFallback(code: string): boolean {
  return PRESIGN_FALLBACK_ERRORS.has(code);
}

function workerFallbackBlocked(file: File): StaffUploadResult | null {
  if (isStaffVideoUpload(file) && file.size > STAFF_WORKER_VIDEO_MAX_BYTES) {
    return { ok: false, code: "video_requires_direct_upload" };
  }
  return null;
}

function resultFromPresign(status: number, body: PresignResponse): PresignOutcome {
  if (status === 401 || body.error === "unauthorized") return { ok: false, code: "unauthorized" };
  if (body.error && presignErrorShouldFallback(body.error)) return "fallback";
  if (RETRY_STATUSES.has(status)) return "retry";
  if (body.ok && typeof body.uploadUrl === "string" && typeof body.url === "string") {
    return {
      kind: "presign",
      uploadUrl: body.uploadUrl,
      publicUrl: normalizeStaffMediaUrl(body.url),
      contentType: body.contentType || "",
    };
  }
  const code = typeof body.error === "string" && body.error.length > 0 ? body.error : "unknown";
  if (presignErrorShouldFallback(code)) return "fallback";
  return { ok: false, code };
}

async function uploadViaWorkerProxy(
  file: File,
  formFields: Record<string, string>,
  endpoint: "/api/staff/upload" | "/api/staff/upload-media",
  signal?: AbortSignal,
): Promise<StaffUploadResult> {
  const fd = new FormData();
  fd.append("file", file);
  for (const [k, v] of Object.entries(formFields)) fd.append(k, v);

  const res = await fetch(endpoint, {
    method: "POST",
    body: fd,
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
  if (res.status === 401 || body.error === "unauthorized") return { ok: false, code: "unauthorized" };
  if (res.ok && body.ok && typeof body.url === "string") {
    return { ok: true, url: normalizeStaffMediaUrl(body.url) };
  }
  const code = typeof body.error === "string" && body.error.length > 0 ? body.error : "unknown";
  return { ok: false, code };
}

async function finishDirectOrWorkerFallback(
  file: File,
  workerFallback: {
    endpoint: "/api/staff/upload" | "/api/staff/upload-media";
    fields: Record<string, string>;
  },
  signal?: AbortSignal,
): Promise<StaffUploadResult> {
  const fallback = await uploadViaWorkerFallback(file, workerFallback, signal);
  if (fallback.ok) return fallback;
  if (
    fallback.code === "video_requires_direct_upload" ||
    fallback.code === "video_too_large" ||
    fallback.code === "unauthorized"
  ) {
    return fallback;
  }
  return { ok: false, code: "direct_upload_failed" };
}

async function uploadViaWorkerFallback(
  file: File,
  workerFallback: {
    endpoint: "/api/staff/upload" | "/api/staff/upload-media";
    fields: Record<string, string>;
  },
  signal?: AbortSignal,
): Promise<StaffUploadResult> {
  const blocked = workerFallbackBlocked(file);
  if (blocked) return blocked;
  try {
    return await uploadViaWorkerProxy(file, workerFallback.fields, workerFallback.endpoint, signal);
  } catch {
    if (signal?.aborted) return { ok: false, code: "aborted" };
    return { ok: false, code: "network" };
  }
}

async function uploadStaffFileDirect(
  file: File,
  presignPayload: Record<string, string>,
  workerFallback: {
    endpoint: "/api/staff/upload" | "/api/staff/upload-media";
    fields: Record<string, string>;
  },
  opts?: { onSuccess?: () => void; signal?: AbortSignal },
): Promise<StaffUploadResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (opts?.signal?.aborted) return { ok: false, code: "aborted" };

    let presign: (PresignResponse & { status: number }) | null = null;
    try {
      presign = await requestPresignedUpload(presignPayload, opts?.signal);
    } catch {
      if (opts?.signal?.aborted) return { ok: false, code: "aborted" };
      if (attempt < 2) {
        await delay(500 * (attempt + 1));
        continue;
      }
      return uploadViaWorkerFallback(file, workerFallback, opts?.signal);
    }

    const parsed = resultFromPresign(presign.status, presign);
    if (parsed === "fallback") {
      return uploadViaWorkerFallback(file, workerFallback, opts?.signal);
    }
    if (parsed === "retry") {
      if (attempt >= 2) return { ok: false, code: "unknown" };
      await delay(500 * (attempt + 1));
      continue;
    }
    if ("ok" in parsed && !parsed.ok) {
      if (presignErrorShouldFallback(parsed.code)) {
        return uploadViaWorkerFallback(file, workerFallback, opts?.signal);
      }
      return parsed;
    }
    if (!("kind" in parsed) || parsed.kind !== "presign") return { ok: false, code: "unknown" };

    const contentType = parsed.contentType || file.type || "application/octet-stream";

    let putOk = false;
    try {
      putOk = await putFileToPresignedUrl(parsed.uploadUrl, file, contentType, opts?.signal);
    } catch {
      if (opts?.signal?.aborted) return { ok: false, code: "aborted" };
      if (attempt < 2) {
        await delay(500 * (attempt + 1));
        continue;
      }
      return finishDirectOrWorkerFallback(file, workerFallback, opts?.signal);
    }

    if (!putOk) {
      if (attempt >= 2) {
        return finishDirectOrWorkerFallback(file, workerFallback, opts?.signal);
      }
      await delay(500 * (attempt + 1));
      continue;
    }

    opts?.onSuccess?.();
    return { ok: true, url: parsed.publicUrl };
  }

  return { ok: false, code: "unknown" };
}

/** Product / site / collection images — direct to R2 when presign secrets are set. */
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

  const mime = staffImageMimeFromFile(prepared);
  return uploadStaffFileDirect(
    prepared,
    { mime, scope, fileName: prepared.name },
    { endpoint: "/api/staff/upload", fields: { scope } },
    opts,
  );
}

export type StaffMediaKind = "hero" | "journal" | "product" | "site";

/** Hero video / journal image / product video — direct to R2 when presign secrets are set. */
export async function uploadStaffMediaFile(
  file: File,
  kind: StaffMediaKind,
  opts?: { onSuccess?: () => void; signal?: AbortSignal },
): Promise<StaffUploadResult> {
  const videoMime = staffVideoMimeFromFile(file);
  const mime = videoMime.startsWith("video/") ? videoMime : staffImageMimeFromFile(file);

  return uploadStaffFileDirect(
    file,
    { mime, kind, fileName: file.name },
    { endpoint: "/api/staff/upload-media", fields: { kind } },
    opts,
  );
}

export function translateStaffUploadError(code: string, t: (key: string) => string): string {
  const key = `staff.images.uploadErr.${code}`;
  const txt = t(key);
  return txt === key ? t("staff.images.uploadErr.unknown") : txt;
}
