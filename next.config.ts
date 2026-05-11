import type { NextConfig } from "next";
import path from "node:path";

function supabaseStorageImagePattern(): { protocol: "https"; hostname: string; pathname: string }[] {
  const raw = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return [];
  try {
    const host = new URL(raw).hostname;
    if (!host) return [];
    return [
      {
        protocol: "https",
        hostname: host,
        pathname: "/storage/v1/object/public/**",
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  /* Monorepo / stray lockfile: pin tracing to this app so `next dev` picks the right root */
  outputFileTracingRoot: path.join(process.cwd()),
  output: "standalone",
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
      },
      ...supabaseStorageImagePattern(),
    ],
  },
};

export default nextConfig;


import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
