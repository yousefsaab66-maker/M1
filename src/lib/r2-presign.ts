import { CopyObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { R2_PRESIGNED_PUT_CACHE_CONTROL } from "@/lib/supabase/storage-constants";

export { R2_PRESIGNED_PUT_CACHE_CONTROL };

export type R2PresignConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

/** R2 S3 API credentials — set via Worker secrets (`wrangler secret put`). */
export function getR2PresignConfig(): R2PresignConfig | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim() || "muhra-media";
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export function isR2PresignConfigured(): boolean {
  return getR2PresignConfig() !== null;
}

let cachedClient: S3Client | null = null;
let cachedClientKey = "";

function getR2S3Client(cfg: R2PresignConfig): S3Client {
  const key = `${cfg.accountId}:${cfg.accessKeyId}:${cfg.bucket}`;
  if (cachedClient && cachedClientKey === key) return cachedClient;
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  cachedClientKey = key;
  return cachedClient;
}

function encodeCopySource(bucket: string, objectKey: string): string {
  const encodedKey = objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${bucket}/${encodedKey}`;
}

/**
 * Presigned PUT URL — browser uploads directly to R2 (bypasses Worker body limit).
 * Only Content-Type is signed; Cache-Control is applied server-side after PUT via CopyObject.
 */
export async function createR2PresignedPutUrl(
  objectKey: string,
  contentType: string,
  expiresInSec = 3600,
): Promise<string | null> {
  const cfg = getR2PresignConfig();
  if (!cfg) return null;

  const client = getR2S3Client(cfg);
  const command = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: objectKey,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, {
    expiresIn: expiresInSec,
    // R2 browser PUT must send the same Content-Type the URL was signed with.
    signableHeaders: new Set(["content-type"]),
  });
}

/** Set immutable cache headers on an object after browser direct upload. */
export async function applyR2ObjectCacheControl(objectKey: string): Promise<boolean> {
  const cfg = getR2PresignConfig();
  if (!cfg) return false;

  const client = getR2S3Client(cfg);
  try {
    await client.send(
      new CopyObjectCommand({
        Bucket: cfg.bucket,
        Key: objectKey,
        CopySource: encodeCopySource(cfg.bucket, objectKey),
        CacheControl: R2_PRESIGNED_PUT_CACHE_CONTROL,
        MetadataDirective: "REPLACE",
      }),
    );
    return true;
  } catch {
    return false;
  }
}
