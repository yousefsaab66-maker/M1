"use client";

import Image, { type ImageProps } from "next/image";

/**
 * Drop-in wrapper around `next/image`. Only `data:` URLs bypass the optimizer
 * (staff uploads). Remote hosts in `next.config` `remotePatterns` use Next/CF
 * image optimization in production.
 */
export function SafeImage({ src, alt, unoptimized, ...rest }: ImageProps) {
  const isData = typeof src === "string" && src.startsWith("data:");
  return <Image src={src} alt={alt} unoptimized={unoptimized || isData} {...rest} />;
}
