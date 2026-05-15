"use client";

import Image, { type ImageProps } from "next/image";

/**
 * Drop-in wrapper around `next/image` that automatically opts out of the Next.js
 * image optimizer for `data:` URLs (uploaded by staff from their computer).
 *
 * The optimizer will reject `data:` and remote hostnames not declared in
 * `next.config`, so any image whose source is a data URL must be passed through
 * with `unoptimized`.
 *
 * On Cloudflare Workers with the `IMAGES` binding, remote optimization uses
 * Image Transformations; sources like `media.*` must be allow-listed in the
 * dashboard or fetches fail silently → broken cards. Serving remote `http(s):` URLs unoptimized in production lets the browser load them
 * directly (still subject to `remotePatterns`).
 */
export function SafeImage({ src, alt, unoptimized, ...rest }: ImageProps) {
  const isData = typeof src === "string" && src.startsWith("data:");
  const isRemoteHttp =
    typeof src === "string" &&
    (src.startsWith("https://") || src.startsWith("http://"));
  const bypassCfImageOptimizer =
    process.env.NODE_ENV === "production" && isRemoteHttp;
  return (
    <Image
      src={src}
      alt={alt}
      unoptimized={unoptimized || isData || bypassCfImageOptimizer}
      {...rest}
    />
  );
}
