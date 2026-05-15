import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Minimal R2 bucket surface used by staff media + site settings routes. */
export type MuhraMediaR2ObjectBody = {
  text(): Promise<string>;
  uploaded?: Date;
};

export type MuhraMediaR2Bucket = {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream | Blob | string | null,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<MuhraMediaR2ObjectBody | null>;
};

function isR2BucketLike(v: unknown): v is MuhraMediaR2Bucket {
  return Boolean(v && typeof v === "object" && typeof (v as MuhraMediaR2Bucket).put === "function");
}

function bucketFromEnv(env: Record<string, unknown>): MuhraMediaR2Bucket | undefined {
  const preferred = ["MUHRA_MEDIA", "muhra_media", "muhra_media_preview"] as const;
  for (const key of preferred) {
    const b = env[key];
    if (isR2BucketLike(b)) return b;
  }
  for (const [key, val] of Object.entries(env)) {
    if (!/media|r2/i.test(key)) continue;
    if (isR2BucketLike(val)) return val;
  }
  return undefined;
}

export async function getMuhraMediaR2Binding(): Promise<MuhraMediaR2Bucket | undefined> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return bucketFromEnv(env as Record<string, unknown>);
  } catch {
    /* Netlify / plain Node / OpenNext context unavailable */
  }
  return undefined;
}

export { isR2PublicConfigured as isR2ConfiguredAtRuntime } from "@/lib/r2-config";

export async function uploadStaffBlobToR2(
  bucket: MuhraMediaR2Bucket,
  key: string,
  body: Buffer | Uint8Array | ArrayBuffer,
  contentType: string,
): Promise<void> {
  await bucket.put(key, body, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
}
