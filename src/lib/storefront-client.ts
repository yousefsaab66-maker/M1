import type { Collection, SiteContent } from "@/lib/catalog";
import { normalizeSiteContent } from "@/lib/site-display";

export type StorefrontClientPayload = {
  site: SiteContent;
  collections: Collection[];
  updatedAt?: string;
};

export type FetchStorefrontClientResult =
  | {
      ok: true;
      site: SiteContent;
      collections: Collection[];
      updatedAt: string | null;
      source: "r2" | "api";
    }
  | { ok: false };

const CLIENT_CACHE_MS = 60_000;

type CachedEntry<T> = { at: number; etag: string | null; value: T };

let cdnStorefrontCache: CachedEntry<FetchStorefrontClientResult> | null = null;
let apiStorefrontCache: CachedEntry<FetchStorefrontClientResult> | null = null;
let bootstrapCache: CachedEntry<CatalogBootstrapClientResult> | null = null;

function readCache<T>(entry: CachedEntry<T> | null): T | null {
  if (!entry) return null;
  if (Date.now() - entry.at > CLIENT_CACHE_MS) return null;
  return entry.value;
}

function writeCache<T>(entry: CachedEntry<T> | null, value: T, etag: string | null): CachedEntry<T> {
  return { at: Date.now(), etag, value };
}

function parseStorefrontPayload(raw: unknown): StorefrontClientPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as StorefrontClientPayload;
  if (!d.site || typeof d.site !== "object" || !Array.isArray(d.collections)) return null;
  return d;
}

/** Read public JSON from R2 CDN (no Worker CPU) — works on every device if CORS allows the store origin. */
export async function fetchStorefrontFromPublicCdn(
  signal?: AbortSignal,
  opts?: { bust?: boolean },
): Promise<FetchStorefrontClientResult> {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim();
  if (!base) return { ok: false };

  if (!opts?.bust) {
    const hit = readCache(cdnStorefrontCache);
    if (hit) return hit;
  }

  try {
    const url = `${base.replace(/\/$/, "")}/site/storefront.json`;
    const headers: HeadersInit = {};
    if (!opts?.bust && cdnStorefrontCache?.etag) {
      headers["If-None-Match"] = cdnStorefrontCache.etag;
    }
    const res = await fetch(url, { cache: "default", signal, mode: "cors", headers });
    if (res.status === 304 && cdnStorefrontCache?.value.ok) {
      cdnStorefrontCache = { ...cdnStorefrontCache, at: Date.now() };
      return cdnStorefrontCache.value;
    }
    if (!res.ok) return { ok: false };
    const parsed = parseStorefrontPayload(await res.json());
    if (!parsed) return { ok: false };
    const result: FetchStorefrontClientResult = {
      ok: true,
      site: normalizeSiteContent(parsed.site),
      collections: parsed.collections,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      source: "r2",
    };
    cdnStorefrontCache = writeCache(cdnStorefrontCache, result, res.headers.get("etag"));
    return result;
  } catch {
    return { ok: false };
  }
}

export async function fetchStorefrontFromApi(
  signal?: AbortSignal,
  opts?: { bust?: boolean },
): Promise<FetchStorefrontClientResult> {
  if (!opts?.bust) {
    const hit = readCache(apiStorefrontCache);
    if (hit) return hit;
  }

  try {
    const res = await fetch("/api/catalog/storefront", {
      cache: "default",
      credentials: "same-origin",
      signal,
    });
    if (!res.ok) return { ok: false };
    const d = (await res.json()) as {
      site?: SiteContent | null;
      collections?: Collection[] | null;
      updatedAt?: string | null;
      source?: "r2" | "none";
    };
    if (!d.site || typeof d.site !== "object" || !Array.isArray(d.collections)) {
      return { ok: false };
    }
    const result: FetchStorefrontClientResult = {
      ok: true,
      site: normalizeSiteContent(d.site),
      collections: d.collections,
      updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : null,
      source: d.source === "r2" ? "r2" : "api",
    };
    apiStorefrontCache = writeCache(apiStorefrontCache, result, res.headers.get("etag"));
    return result;
  } catch {
    return { ok: false };
  }
}

/** CDN first (shared truth), then same-origin API. */
export async function fetchStorefrontForClient(
  signal?: AbortSignal,
  opts?: { bust?: boolean },
): Promise<FetchStorefrontClientResult> {
  const cdn = await fetchStorefrontFromPublicCdn(signal, opts);
  if (cdn.ok) return cdn;
  return fetchStorefrontFromApi(signal, opts);
}

export function remoteStorefrontIsNewer(remoteAt: string | null, localAt: string | null): boolean {
  if (!remoteAt) return false;
  if (!localAt) return true;
  return new Date(remoteAt).getTime() >= new Date(localAt).getTime();
}

export type CatalogBootstrapClientResult =
  | {
      ok: true;
      products: import("@/lib/catalog").Product[];
      site: SiteContent | null;
      collections: Collection[] | null;
      updatedAt: string | null;
      source: "r2" | "none";
      r2Ready: boolean;
    }
  | { ok: false };

export async function fetchCatalogBootstrapClient(
  signal?: AbortSignal,
  opts?: { bust?: boolean },
): Promise<CatalogBootstrapClientResult> {
  if (!opts?.bust) {
    const hit = readCache(bootstrapCache);
    if (hit) return hit;
  }

  try {
    const res = await fetch("/api/catalog/bootstrap", {
      cache: "default",
      credentials: "same-origin",
      signal,
    });
    if (!res.ok) return { ok: false };
    const d = (await res.json()) as {
      products?: unknown;
      site?: SiteContent | null;
      collections?: Collection[] | null;
      storefrontUpdatedAt?: string | null;
      storefrontSource?: "r2" | "none";
      r2Ready?: boolean;
    };
    const products = Array.isArray(d.products) ? d.products : [];
    const result: CatalogBootstrapClientResult = {
      ok: true,
      products: products as import("@/lib/catalog").Product[],
      site: d.site && typeof d.site === "object" ? normalizeSiteContent(d.site) : null,
      collections: Array.isArray(d.collections) ? d.collections : null,
      updatedAt: typeof d.storefrontUpdatedAt === "string" ? d.storefrontUpdatedAt : null,
      source: d.storefrontSource === "r2" ? "r2" : "none",
      r2Ready: d.r2Ready === true,
    };
    bootstrapCache = writeCache(bootstrapCache, result, res.headers.get("etag"));
    return result;
  } catch {
    return { ok: false };
  }
}

/** Force next client fetch to bypass the 60s in-memory cache (e.g. after staff save). */
export function bustStorefrontClientCache() {
  cdnStorefrontCache = null;
  apiStorefrontCache = null;
  bootstrapCache = null;
}
