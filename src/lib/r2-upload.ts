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

export async function getMuhraMediaR2Binding(): Promise<MuhraMediaR2Bucket | undefined> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const b = env.MUHRA_MEDIA;
    if (b && typeof b.put === "function") return b as MuhraMediaR2Bucket;
  } catch {
    /* Netlify / plain Node / OpenNext context unavailable */
  }
  return undefined;
}

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
