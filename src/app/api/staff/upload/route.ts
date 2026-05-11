import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { STAFF_COOKIE_NAME, verifyStaffSession } from "@/lib/staff-session";
import { isSupabaseBackendConfigured, supabaseAdmin } from "@/lib/supabase/admin";
import {
  MUHRA_MAX_IMAGE_UPLOAD_BYTES,
  MUHRA_PRODUCT_IMAGES_BUCKET,
  isAllowedStaffImageMime,
  sanitizeStorageFileName,
} from "@/lib/supabase/storage-constants";

export const dynamic = "force-dynamic";

async function requireStaff(): Promise<boolean> {
  const secret = process.env.STAFF_COOKIE_SECRET;
  const jar = await cookies();
  return Boolean(verifyStaffSession(jar.get(STAFF_COOKIE_NAME)?.value, secret));
}

export async function POST(req: Request) {
  if (!(await requireStaff())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!isSupabaseBackendConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string" || !("arrayBuffer" in file)) {
    return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
  }

  const mime = (file.type || "application/octet-stream").trim().toLowerCase();
  if (!isAllowedStaffImageMime(mime)) {
    return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 });
  }

  const size = file.size;
  if (size <= 0 || size > MUHRA_MAX_IMAGE_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: "too_large" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  const baseName = sanitizeStorageFileName(typeof file.name === "string" ? file.name : "image");
  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/webp"
        ? "webp"
        : mime === "image/gif"
          ? "gif"
          : "jpg";
  const slug = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const objectPath = `products/${slug}-${baseName.replace(/\.[^.]+$/, "")}.${ext}`;

  const sb = supabaseAdmin();
  const bucket = MUHRA_PRODUCT_IMAGES_BUCKET;
  const { error: uploadError } = await sb.storage.from(bucket).upload(objectPath, buf, {
    contentType: mime,
    cacheControl: "31536000",
    upsert: false,
  });

  if (uploadError) {
    return NextResponse.json(
      { ok: false, error: uploadError.message || "storage_upload_failed" },
      { status: 502 },
    );
  }

  const { data } = sb.storage.from(bucket).getPublicUrl(objectPath);
  const url = data.publicUrl;

  return NextResponse.json({ ok: true, url, path: objectPath });
}
