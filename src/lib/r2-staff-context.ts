import { getMuhraMediaR2Binding, type MuhraMediaR2Bucket } from "@/lib/r2-upload";
import { getR2PublicBaseUrl } from "@/lib/r2-config";

export type R2StaffUploadError = "r2_media_required" | "r2_public_base_missing";

export type R2StaffContext =
  | { ready: true; bucket: MuhraMediaR2Bucket; publicBase: string }
  | { ready: false; error: R2StaffUploadError };

/** Single gate for staff upload routes — binding + public origin. */
export async function getR2StaffContext(): Promise<R2StaffContext> {
  const publicBase = getR2PublicBaseUrl();
  if (!publicBase) return { ready: false, error: "r2_public_base_missing" };

  const bucket = await getMuhraMediaR2Binding();
  if (!bucket) return { ready: false, error: "r2_media_required" };

  return { ready: true, bucket, publicBase };
}

export async function isR2StaffUploadReady(): Promise<boolean> {
  const ctx = await getR2StaffContext();
  return ctx.ready;
}
