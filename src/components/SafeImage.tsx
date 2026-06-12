"use client";

import Image, { type ImageProps } from "next/image";
import { isCfResizedMediaUrl } from "@/lib/media-image-url";

/**
 * Drop-in wrapper around `next/image`. `data:` and Cloudflare `cdn-cgi/image`
 * URLs load directly; other remotes use Next/CF optimization when configured.
 */
export function SafeImage({ src, alt, unoptimized, ...rest }: ImageProps) {
  const isData = typeof src === "string" && src.startsWith("data:");
  const isCfResized = typeof src === "string" && isCfResizedMediaUrl(src);
  return (
    <Image src={src} alt={alt} unoptimized={unoptimized || isData || isCfResized} {...rest} />
  );
}
