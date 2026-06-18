"use client";

/**
 * Upload path: browser presigned PUT → R2 (fastest). Requires R2 S3 API credentials on the Worker
 * (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) — not Supabase Storage.
 * Workers Paid is not required for presign; it avoids Worker body limits vs proxy upload.
 * Fallback: multipart POST through `/api/staff/upload` when presign is unavailable (small files only).
 */
import { prepareStaffImageForUpload } from "@/lib/staff-image-file";
import { normalizeStaffMediaUrl } from "@/lib/staff-media-url";
import {
  R2_PRESIGNED_PUT_CACHE_CONTROL,
  STAFF_WORKER_PROXY_MAX_BYTES,
  staffImageMimeFromFile,
  staffVideoMimeFromFile,
} from "@/lib/supabase/storage-constants";

export type StaffUploadResult = { ok: true; url: string } | { ok: false; code: string };

export type StaffUploadProgress = {
  phase: "presign" | "upload";
  fileName: string;
};

const RETRY_STATUSES = new Set([429, 502, 503, 524]);

/** Presign route errors that should fall through to Worker proxy upload. */
const PRESIGN_FALLBACK_ERRORS = new Set([
  "r2_presign_not_configured",
  "r2_public_base_missing",
  "r2_media_required",
]);

const WORKER_BODY_LIMIT_ERRORS = new Set(["invalid_body", "too_large", "video_too_large"]);

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function logUploadDebug(message: string, detail?: Record<string, unknown>) {
  if (typeof console !== "undefined" && typeof console.error === "function") {
    console.error(`[staff-upload] ${message}`, detail ?? "");
  }
}

type PresignResponse = {
  ok?: boolean;
  uploadUrl?: string;
  url?: string;
  contentType?: string;
  cacheControl?: string;
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

type PutResult = { ok: true } | { ok: false; status: number; detail: string };

async function putFileToPresignedUrl(
  uploadUrl: string,
  file: File,
  contentType: string,
  cacheControl: string,
  signal?: AbortSignal,
): Promise<PutResult> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
    },
    body: file,
    signal,
  });
  if (res.ok) return { ok: true };
  const detail = (await res.text().catch(() => "")).slice(0, 300);
  logUploadDebug("presigned PUT failed", {
    status: res.status,
    contentType,
    cacheControl,
    fileName: file.name,
    size: file.size,
    detail,
  });
  return { ok: false, status: res.status, detail };
}

type PresignOk = {
  kind: "presign";
  uploadUrl: string;
  publicUrl: string;
  contentType: string;
  cacheControl: string;
};
type PresignOutcome = PresignOk | StaffUploadResult | "retry" | "fallback";

function presignErrorShouldFallback(code: string): boolean {
  return PRESIGN_FALLBACK_ERRORS.has(code);
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
      cacheControl: body.cacheControl || R2_PRESIGNED_PUT_CACHE_CONTROL,
    };
  }
  const code = typeof body.error === "string" && body.error.length > 0 ? body.error : "unknown";
  if (presignErrorShouldFallback(code)) return "fallback";
  return { ok: false, code };
}

function workerFallbackAllowed(file: File): boolean {
  return file.size <= STAFF_WORKER_PROXY_MAX_BYTES;
}

function directPutFailureCode(file: File, putStatus: number | null): string {
  if (putStatus === 403) return "direct_upload_cors";
  if (file.size > STAFF_WORKER_PROXY_MAX_BYTES) return "video_requires_direct_upload";
  return "direct_upload_failed";
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
  logUploadDebug("Worker proxy upload failed", {
    endpoint,
    status: res.status,
    code,
    fileName: file.name,
    size: file.size,
  });
  return { ok: false, code };
}

async function uploadViaWorkerFallback(
  file: File,
  workerFallback: {
    endpoint: "/api/staff/upload" | "/api/staff/upload-media";
    fields: Record<string, string>;
  },
  signal?: AbortSignal,
): Promise<StaffUploadResult> {
  if (!workerFallbackAllowed(file)) {
    return { ok: false, code: "video_requires_direct_upload" };
  }
  try {
    return await uploadViaWorkerProxy(file, workerFallback.fields, workerFallback.endpoint, signal);
  } catch {
    if (signal?.aborted) return { ok: false, code: "aborted" };
    return { ok: false, code: "network" };
  }
}

async function finishPresignPutWithWorkerFallback(
  file: File,
  putStatus: number | null,
  workerFallback: {
    endpoint: "/api/staff/upload" | "/api/staff/upload-media";
    fields: Record<string, string>;
  },
  signal?: AbortSignal,
): Promise<StaffUploadResult> {
  if (!workerFallbackAllowed(file)) {
    return { ok: false, code: directPutFailureCode(file, putStatus) };
  }

  const fallback = await uploadViaWorkerFallback(file, workerFallback, signal);
  if (fallback.ok) return fallback;
  if (fallback.code === "unauthorized") return fallback;
  if (WORKER_BODY_LIMIT_ERRORS.has(fallback.code)) {
    return { ok: false, code: "video_requires_direct_upload" };
  }
  if (fallback.code !== "unknown") return fallback;
  return { ok: false, code: directPutFailureCode(file, putStatus) };
}

/** Presigned browser → R2 PUT first; Worker binding fallback when presign unavailable or PUT fails (small files). */
async function uploadViaPresignedPut(
  file: File,
  presignPayload: Record<string, string>,
  workerFallback: {
    endpoint: "/api/staff/upload" | "/api/staff/upload-media";
    fields: Record<string, string>;
  },
  opts?: {
    onSuccess?: () => void;
    onProgress?: (progress: StaffUploadProgress) => void;
    signal?: AbortSignal;
  },
): Promise<StaffUploadResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (opts?.signal?.aborted) return { ok: false, code: "aborted" };

    opts?.onProgress?.({ phase: "presign", fileName: file.name });

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
    const cacheControl = parsed.cacheControl || R2_PRESIGNED_PUT_CACHE_CONTROL;

    opts?.onProgress?.({ phase: "upload", fileName: file.name });

    let putResult: PutResult;
    try {
      putResult = await putFileToPresignedUrl(
        parsed.uploadUrl,
        file,
        contentType,
        cacheControl,
        opts?.signal,
      );
    } catch {
      if (opts?.signal?.aborted) return { ok: false, code: "aborted" };
      if (attempt < 2) {
        await delay(500 * (attempt + 1));
        continue;
      }
      return finishPresignPutWithWorkerFallback(file, null, workerFallback, opts?.signal);
    }

    if (!putResult.ok) {
      if (attempt >= 2) {
        return finishPresignPutWithWorkerFallback(
          file,
          putResult.status,
          workerFallback,
          opts?.signal,
        );
      }
      await delay(500 * (attempt + 1));
      continue;
    }

    opts?.onSuccess?.();
    return { ok: true, url: parsed.publicUrl };
  }

  return { ok: false, code: "unknown" };
}

/** Product / site / collection images — presigned PUT first, Worker fallback. */
export async function uploadStaffImageFile(
  file: File,
  scope: "site" | "collections" | "products" = "products",
  opts?: {
    onSuccess?: () => void;
    onProgress?: (progress: StaffUploadProgress) => void;
    signal?: AbortSignal;
  },
): Promise<StaffUploadResult> {
  let prepared: File;
  try {
    prepared = await prepareStaffImageForUpload(file);
  } catch {
    return { ok: false, code: "decode_failed" };
  }

  const mime = staffImageMimeFromFile(prepared);
  return uploadViaPresignedPut(
    prepared,
    { mime, scope, fileName: prepared.name },
    { endpoint: "/api/staff/upload", fields: { scope } },
    opts,
  );
}

export type StaffMediaKind = "hero" | "journal" | "product" | "site";

/** Hero video / journal image / product video — presigned PUT first, Worker fallback. */
export async function uploadStaffMediaFile(
  file: File,
  kind: StaffMediaKind,
  opts?: {
    onSuccess?: () => void;
    onProgress?: (progress: StaffUploadProgress) => void;
    signal?: AbortSignal;
  },
): Promise<StaffUploadResult> {
  const videoMime = staffVideoMimeFromFile(file);
  const isVideo = videoMime.startsWith("video/");
  let uploadFile = file;
  if (!isVideo) {
    try {
      uploadFile = await prepareStaffImageForUpload(file);
    } catch {
      return { ok: false, code: "decode_failed" };
    }
  }
  const mime = isVideo ? videoMime : staffImageMimeFromFile(uploadFile);
  return uploadViaPresignedPut(
    uploadFile,
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
