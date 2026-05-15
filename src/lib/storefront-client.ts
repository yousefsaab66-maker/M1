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

function parseStorefrontPayload(raw: unknown): StorefrontClientPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as StorefrontClientPayload;
  if (!d.site || typeof d.site !== "object" || !Array.isArray(d.collections)) return null;
  return d;
}

/** Read public JSON from R2 CDN (no Worker CPU) — works on every device if CORS allows the store origin. */
export async function fetchStorefrontFromPublicCdn(
  signal?: AbortSignal,
): Promise<FetchStorefrontClientResult> {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim();
  if (!base) return { ok: false };

  try {
    const url = `${base.replace(/\/$/, "")}/site/storefront.json?_=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store", signal, mode: "cors" });
    if (!res.ok) return { ok: false };
    const parsed = parseStorefrontPayload(await res.json());
    if (!parsed) return { ok: false };
    return {
      ok: true,
      site: normalizeSiteContent(parsed.site),
      collections: parsed.collections,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      source: "r2",
    };
  } catch {
    return { ok: false };
  }
}

export async function fetchStorefrontFromApi(
  signal?: AbortSignal,
): Promise<FetchStorefrontClientResult> {
  try {
    const res = await fetch(`/api/catalog/storefront?_=${Date.now()}`, {
      cache: "no-store",
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
    return {
      ok: true,
      site: normalizeSiteContent(d.site),
      collections: d.collections,
      updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : null,
      source: d.source === "r2" ? "r2" : "api",
    };
  } catch {
    return { ok: false };
  }
}

/** CDN first (shared truth), then same-origin API. */
export async function fetchStorefrontForClient(
  signal?: AbortSignal,
): Promise<FetchStorefrontClientResult> {
  const cdn = await fetchStorefrontFromPublicCdn(signal);
  if (cdn.ok) return cdn;
  return fetchStorefrontFromApi(signal);
}
