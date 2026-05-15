import type { NextConfig } from "next";
import type { RemotePattern } from "next/dist/shared/lib/image-config";
import path from "node:path";

function supabaseStorageImagePattern(): RemotePattern[] {
  const raw = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return [];
  try {
    const u = new URL(raw);
    if (!u.hostname) return [];
    if (u.protocol !== "https:" && u.protocol !== "http:") return [];
    const protocol = u.protocol === "https:" ? "https" : "http";
    const pattern: RemotePattern = {
      protocol,
      hostname: u.hostname,
      pathname: "/storage/v1/object/public/**",
    };
    if (u.port) pattern.port = u.port;
    return [pattern];
  } catch {
    return [];
  }
}

/**
 * Extra `next/image` hosts when the OpenNext build runs **without** `R2_PUBLIC_BASE_URL` in the shell
 * (common on CI / deploy machines). Comma-separated hostnames only, HTTPS, path `/**`.
 * Set `MUHRA_IMAGE_HOST_FALLBACKS=` (empty) to disable defaults for non-MUHRA forks.
 */
function catalogImageHostFallbackPatterns(): RemotePattern[] {
  const rawEnv = process.env.MUHRA_IMAGE_HOST_FALLBACKS;
  const raw = (rawEnv === undefined ? "media.muhrajewelry.com" : rawEnv).trim();
  if (!raw) return [];
  const seen = new Set<string>();
  const out: RemotePattern[] = [];
  for (const hostname of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (!hostname || seen.has(hostname)) continue;
    seen.add(hostname);
    out.push({ protocol: "https", hostname, pathname: "/**" });
  }
  return out;
}

/** Allow `next/image` for staff uploads from the R2 public origin (read when `next dev` / `next build` starts — restart after changing `.env.local`). */
function r2PublicImagePatterns(): RemotePattern[] {
  const seen = new Set<string>();
  const out: RemotePattern[] = [];
  for (const raw of [
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim(),
    process.env.R2_PUBLIC_BASE_URL?.trim(),
  ]) {
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    try {
      const u = new URL(raw);
      if (!u.hostname) continue;
      if (u.protocol !== "https:" && u.protocol !== "http:") continue;
      const protocol = u.protocol === "https:" ? "https" : "http";
      const prefix = u.pathname.replace(/\/$/, "");
      const pattern: RemotePattern = {
        protocol,
        hostname: u.hostname,
        pathname: prefix.length > 0 ? `${prefix}/**` : "/**",
      };
      if (u.port) pattern.port = u.port;
      out.push(pattern);
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
  experimental: {
    /** Default static staleTime is 300s — can show stale layouts between navigations. */
    staleTimes: {
      dynamic: 0,
      static: 30,
    },
  },
  images: {
    /**
     * Dev-only: default image optimizer blocks fetching from loopback/private IPs even when the host is in `remotePatterns`.
     * Needed for `http://127.0.0.1:…` R2/custom domain or local Supabase Storage while running `next dev`.
     */
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
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
      ...catalogImageHostFallbackPatterns(),
    ],
  },
};

export default nextConfig;


import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
