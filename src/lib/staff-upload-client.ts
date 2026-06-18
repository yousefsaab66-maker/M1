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

/** Worker proxy body-limit errors — only relevant for small-file fallback. */
const WORKER_BODY_LIMIT_ERRORS = new Set(["invalid_body", "too_large", "worker_proxy_too_large"]);

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
  path?: string;
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

type PutResult = { ok: true } | { ok: false; status: number; detail: string };

async function putFileToPresignedUrl(
  uploadUrl: string,
  file: File,
  contentType: string,
  signal?: AbortSignal,
): Promise<PutResult> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
    signal,
  });
  if (res.ok) return { ok: true };
  const detail = (await res.text().catch(() => "")).slice(0, 300);
  logUploadDebug("presigned PUT failed", {
    status: res.status,
    statusText: res.statusText,
    contentType,
    fileName: file.name,
    size: file.size,
    detail,
  });
  return { ok: false, status: res.status, detail };
}

async function finalizeDirectUpload(objectPath: string, signal?: AbortSignal): Promise<void> {
  try {
    await fetch("/api/staff/upload-finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ path: objectPath }),
      signal,
    });
  } catch {
    /* cache headers are best-effort after successful PUT */
  }
}

type PresignOk = {
  kind: "presign";
  uploadUrl: string;
  publicUrl: string;
  objectPath: string;
  contentType: string;
};
type PresignOutcome = PresignOk | StaffUploadResult | "retry" | "fallback";

function presignErrorShouldFallback(code: string): boolean {
  return PRESIGN_FALLBACK_ERRORS.has(code);
}

function resultFromPresign(status: number, body: PresignResponse): PresignOutcome {
  if (status === 401 || body.error === "unauthorized") return { ok: false, code: "unauthorized" };
  if (body.error && presignErrorShouldFallback(body.error)) return "fallback";
  if (RETRY_STATUSES.has(status)) return "retry";
  if (
    body.ok &&
    typeof body.uploadUrl === "string" &&
    typeof body.url === "string" &&
    typeof body.path === "string" &&
    typeof body.contentType === "string" &&
    body.contentType.length > 0
  ) {
    return {
      kind: "presign",
      uploadUrl: body.uploadUrl,
      publicUrl: normalizeStaffMediaUrl(body.url),
      objectPath: body.path,
      contentType: body.contentType,
    };
  }
  const code = typeof body.error === "string" && body.error.length > 0 ? body.error : "unknown";
  if (presignErrorShouldFallback(code)) return "fallback";
  return { ok: false, code };
}

function workerFallbackAllowed(file: File): boolean {
  return file.size <= STAFF_WORKER_PROXY_MAX_BYTES;
}

function directPutFailureCode(putStatus: number | null, detail?: string): string {
  if (putStatus === null) return "network";
  if (putStatus === 403) {
    const d = (detail || "").toLowerCase();
    if (d.includes("signaturedoesnotmatch") || d.includes("signature")) {
      return "direct_upload_signature";
    }
    return "direct_upload_cors";
  }
  if (putStatus >= 400) return "direct_upload_put_failed";
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
    return { ok: false, code: "r2_presign_not_configured" };
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
  putDetail: string | undefined,
  workerFallback: {
    endpoint: "/api/staff/upload" | "/api/staff/upload-media";
    fields: Record<string, string>;
  },
  signal?: AbortSignal,
): Promise<StaffUploadResult> {
  if (!workerFallbackAllowed(file)) {
    return { ok: false, code: directPutFailureCode(putStatus, putDetail) };
  }

  const fallback = await uploadViaWorkerFallback(file, workerFallback, signal);
  if (fallback.ok) return fallback;
  if (fallback.code === "unauthorized") return fallback;
  if (WORKER_BODY_LIMIT_ERRORS.has(fallback.code)) {
    return { ok: false, code: "worker_proxy_too_large" };
  }
  if (fallback.code !== "unknown") return fallback;
  return { ok: false, code: directPutFailureCode(putStatus, putDetail) };
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
      if (!workerFallbackAllowed(file)) return { ok: false, code: "network" };
      return uploadViaWorkerFallback(file, workerFallback, opts?.signal);
    }

    const parsed = resultFromPresign(presign.status, presign);
    if (parsed === "fallback") {
      if (!workerFallbackAllowed(file)) {
        return { ok: false, code: "r2_presign_not_configured" };
      }
      return uploadViaWorkerFallback(file, workerFallback, opts?.signal);
    }
    if (parsed === "retry") {
      if (attempt >= 2) return { ok: false, code: "unknown" };
      await delay(500 * (attempt + 1));
      continue;
    }
    if ("ok" in parsed && !parsed.ok) {
      if (presignErrorShouldFallback(parsed.code)) {
        if (!workerFallbackAllowed(file)) {
          return { ok: false, code: "r2_presign_not_configured" };
        }
        return uploadViaWorkerFallback(file, workerFallback, opts?.signal);
      }
      return parsed;
    }
    if (!("kind" in parsed) || parsed.kind !== "presign") return { ok: false, code: "unknown" };

    opts?.onProgress?.({ phase: "upload", fileName: file.name });

    let putResult: PutResult;
    try {
      putResult = await putFileToPresignedUrl(
        parsed.uploadUrl,
        file,
        parsed.contentType,
        opts?.signal,
      );
    } catch {
      if (opts?.signal?.aborted) return { ok: false, code: "aborted" };
      if (attempt < 2) {
        await delay(500 * (attempt + 1));
        continue;
      }
      if (!workerFallbackAllowed(file)) return { ok: false, code: "network" };
      return finishPresignPutWithWorkerFallback(file, null, undefined, workerFallback, opts?.signal);
    }

    if (!putResult.ok) {
      if (attempt >= 2) {
        return finishPresignPutWithWorkerFallback(
          file,
          putResult.status,
          putResult.detail,
          workerFallback,
          opts?.signal,
        );
      }
      await delay(500 * (attempt + 1));
      continue;
    }

    void finalizeDirectUpload(parsed.objectPath, opts?.signal);
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
