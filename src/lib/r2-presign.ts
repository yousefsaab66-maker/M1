import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

/** Presigned PUT URL — browser uploads directly to R2 (bypasses Worker body limit). */
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
    CacheControl: "public, max-age=31536000, immutable",
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSec });
}
