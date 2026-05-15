import type { SiteContent } from "@/lib/catalog";
import { normalizeSiteContent } from "@/lib/site-display";
import { sanitizeSiteContentForServer } from "@/lib/site-content-storage";
import { getMuhraMediaR2Binding } from "@/lib/r2-upload";

/** Public site settings JSON — all devices read this object from R2 via the Worker API. */
export const SITE_SETTINGS_R2_KEY = "site/content.json";

export type ReadSiteR2Result =
  | { ok: true; site: SiteContent; updatedAt: string | null }
  | { ok: true; site: null }
  | { ok: false; error: "r2_not_configured" | "r2_read_failed" };

export type WriteSiteR2Result =
  | { ok: true; updatedAt: string }
  | { ok: false; error: "r2_not_configured" | "r2_write_failed" | "embedded_media" };

export async function readSiteSettingsFromR2(): Promise<ReadSiteR2Result> {
  const bucket = await getMuhraMediaR2Binding();
  if (!bucket) return { ok: false, error: "r2_not_configured" };

  try {
    const obj = await bucket.get(SITE_SETTINGS_R2_KEY);
    if (!obj) return { ok: true, site: null };

    const text = await obj.text();
    const parsed = JSON.parse(text) as SiteContent;
    if (!parsed || typeof parsed !== "object") return { ok: true, site: null };

    const updatedAt =
      obj.uploaded instanceof Date ? obj.uploaded.toISOString() : null;

    return {
      ok: true,
      site: normalizeSiteContent(parsed),
      updatedAt,
    };
  } catch {
    return { ok: false, error: "r2_read_failed" };
  }
}

export async function writeSiteSettingsToR2(site: SiteContent): Promise<WriteSiteR2Result> {
  const sanitized = sanitizeSiteContentForServer(site);
  if (!sanitized.ok) {
    return { ok: false, error: "embedded_media" };
  }

  const bucket = await getMuhraMediaR2Binding();
  if (!bucket) return { ok: false, error: "r2_not_configured" };

  const updatedAt = new Date().toISOString();
  try {
    await bucket.put(SITE_SETTINGS_R2_KEY, JSON.stringify(sanitized.site), {
      httpMetadata: {
        contentType: "application/json; charset=utf-8",
        cacheControl: "public, max-age=60",
      },
    });
    return { ok: true, updatedAt };
  } catch {
    return { ok: false, error: "r2_write_failed" };
  }
}
