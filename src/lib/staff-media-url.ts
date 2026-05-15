import { getR2PublicBaseUrl } from "@/lib/r2-config";

const DEFAULT_MEDIA_ORIGIN = "https://media.muhrajewelry.com";

function mediaOrigin(): string {
  const base = getR2PublicBaseUrl() || process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim();
  return (base || DEFAULT_MEDIA_ORIGIN).replace(/\/$/, "");
}

/** Strip RTL embedding marks that break URL inputs in Arabic UI. */
function stripBidiMarks(s: string): string {
  return s.replace(/[\u200e\u200f\u202a-\u202e]/g, "");
}

/**
 * Normalize staff-pasted or RTL-garbled media URLs before save/display.
 * Fixes `...//:https`, missing protocol, and `muhrajewelry.com/site/...` → media CDN.
 */
export function normalizeStaffMediaUrl(raw: string): string {
  let v = stripBidiMarks(raw.trim());
  if (!v) return "";

  if (v.startsWith("data:") || v.startsWith("blob:")) return v;

  // RTL Arabic inputs may garble the scheme (`...//:https`) — recover if `http` appears mid-string
  if (!/^https?:\/\//i.test(v)) {
    const idx = v.toLowerCase().indexOf("http");
    if (idx > 0) v = v.slice(idx);
  }

  if (v.startsWith("//")) v = `https:${v}`;

  const origin = mediaOrigin();

  if (!/^https?:\/\//i.test(v)) {
    if (/^(site|products|hero|journal)(\/|$)/i.test(v)) {
      return `${origin}/${v.replace(/^\/+/, "")}`;
    }
    if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}/i.test(v)) {
      v = `https://${v}`;
    }
  }

  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return v;

    // Storefront HTML is on apex; objects live on media.*
    if (
      (u.hostname === "muhrajewelry.com" || u.hostname === "www.muhrajewelry.com") &&
      /^\/(site|products|hero|journal)\//.test(u.pathname)
    ) {
      const media = new URL(origin);
      media.pathname = u.pathname.replace(/\/{2,}/g, "/");
      return media.href;
    }

    u.pathname = u.pathname.replace(/\/{2,}/g, "/");
    return u.href;
  } catch {
    return v;
  }
}

export function isValidStaffMediaUrl(url: string): boolean {
  const v = normalizeStaffMediaUrl(url);
  if (!v) return true;
  if (v.startsWith("data:") || v.startsWith("blob:")) return false;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}
