/**
 * Augments OpenNext `CloudflareEnv` with app R2 bindings.
 * `npm run cf-typegen` writes `cloudflare-env.d.ts` at repo root — keep this file separate so it is not overwritten.
 */
export {};

declare global {
  interface CloudflareEnv {
    /** Staff catalogue images — optional; see `wrangler.jsonc` → `r2_buckets`. */
    MUHRA_MEDIA?: {
      put(
        key: string,
        value: ArrayBuffer | ArrayBufferView | ReadableStream | Blob | string | null,
        options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
      ): Promise<unknown>;
    };
  }
}
