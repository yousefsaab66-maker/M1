import type { SiteContent } from "@/lib/catalog";
import { normalizeSiteContent } from "@/lib/site-display";
import { sanitizeSiteContentForServer } from "@/lib/site-content-storage";
import { isSupabaseBackendConfigured, supabaseAdmin } from "@/lib/supabase/admin";
import { readSiteSettingsFromR2, writeSiteSettingsToR2 } from "@/lib/site-settings-r2";

const SITE_ROW_ID = "default";

export type FetchSiteContentResult =
  | { kind: "ok"; site: SiteContent | null; updatedAt: string | null }
  | { kind: "not_configured" }
  | { kind: "error"; message: string };

export type UpsertSiteContentResult =
  | { ok: true; updatedAt: string }
  | { ok: false; error: string };

async function fetchSiteContentFromSupabase(): Promise<FetchSiteContentResult> {
  if (!isSupabaseBackendConfigured()) return { kind: "not_configured" };
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("site_settings")
      .select("content, updated_at")
      .eq("id", SITE_ROW_ID)
      .maybeSingle();

    if (error) {
      if (error.code === "42P01" || error.message.includes("site_settings")) {
        return { kind: "ok", site: null, updatedAt: null };
      }
      return { kind: "error", message: error.message };
    }

    const updatedAt =
      typeof data?.updated_at === "string" && data.updated_at.length > 0 ? data.updated_at : null;

    if (!data?.content || typeof data.content !== "object") {
      return { kind: "ok", site: null, updatedAt };
    }

    const raw = data.content as Record<string, unknown>;
    if (Object.keys(raw).length === 0) {
      return { kind: "ok", site: null, updatedAt };
    }

    return {
      kind: "ok",
      site: normalizeSiteContent(data.content as SiteContent),
      updatedAt,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return { kind: "error", message: msg };
  }
}

async function upsertSiteContentToSupabase(site: SiteContent): Promise<UpsertSiteContentResult> {
  if (!isSupabaseBackendConfigured()) return { ok: false, error: "backend_not_configured" };

  const sanitized = sanitizeSiteContentForServer(site);
  if (!sanitized.ok) {
    return { ok: false, error: "embedded_media" };
  }

  try {
    const sb = supabaseAdmin();
    const updatedAt = new Date().toISOString();
    const { error } = await sb.from("site_settings").upsert({
      id: SITE_ROW_ID,
      content: sanitized.site,
      updated_at: updatedAt,
    });

    if (error) {
      if (error.code === "42P01" || error.message.includes("site_settings")) {
        return { ok: false, error: "table_missing" };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, updatedAt };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return { ok: false, error: msg };
  }
}

/** R2 first (shared across all visitors), Supabase as fallback. */
export async function fetchSiteContent(): Promise<FetchSiteContentResult> {
  const r2 = await readSiteSettingsFromR2();
  if (r2.ok && r2.site) {
    return { kind: "ok", site: r2.site, updatedAt: r2.updatedAt };
  }
  if (r2.ok === false && r2.error === "r2_read_failed") {
    return { kind: "error", message: r2.error };
  }

  return fetchSiteContentFromSupabase();
}

/** Persist site settings — R2 is required in production; mirrors to Supabase when possible. */
export async function upsertSiteContent(site: SiteContent): Promise<UpsertSiteContentResult> {
  const r2 = await writeSiteSettingsToR2(site);
  if (r2.ok) {
    void upsertSiteContentToSupabase(site).catch(() => undefined);
    return { ok: true, updatedAt: r2.updatedAt };
  }

  if (r2.error === "embedded_media") {
    return { ok: false, error: "embedded_media" };
  }

  if (r2.error === "r2_not_configured" || r2.error === "r2_write_failed") {
    const sb = await upsertSiteContentToSupabase(site);
    if (sb.ok) return sb;
    if (r2.error === "r2_not_configured") {
      return { ok: false, error: "r2_not_configured" };
    }
    return { ok: false, error: "r2_write_failed" };
  }

  return { ok: false, error: "generic" };
}
