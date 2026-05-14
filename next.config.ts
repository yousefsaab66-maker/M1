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

/** Allow `next/image` for staff uploads from the R2 public origin (build-time env). Hero `<video src>` uses the same hostnames without going through the image optimizer. */
function r2PublicImagePatterns(): { protocol: "https"; hostname: string; pathname: string }[] {
  const seen = new Set<string>();
  const out: { protocol: "https"; hostname: string; pathname: string }[] = [];
  for (const raw of [
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim(),
    process.env.R2_PUBLIC_BASE_URL?.trim(),
  ]) {
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    try {
      const u = new URL(raw);
      if (u.protocol !== "https:" || !u.hostname) continue;
      const prefix = u.pathname.replace(/\/$/, "");
      out.push({
        protocol: "https",
        hostname: u.hostname,
        pathname: prefix.length > 0 ? `${prefix}/**` : "/**",
      });
    } catch {
      /* ignore invalid */
    }
  }
  return out;
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
      ...r2PublicImagePatterns(),
    ],
  },
};

export default nextConfig;


import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
