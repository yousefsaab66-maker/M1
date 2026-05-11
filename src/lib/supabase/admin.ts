import { createClient } from "@supabase/supabase-js";

/**
 * Project URL for server-only code (Route Handlers, Server Actions).
 * Prefer `SUPABASE_URL` on hosts like Cloudflare Workers: `NEXT_PUBLIC_*` is inlined at
 * `next build`; if build env omits it, the Worker bundle keeps an empty string and ignores
 * dashboard vars added later. `SUPABASE_URL` is read at runtime.
 */
export function supabaseProjectUrl(): string | undefined {
  const u = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (typeof u !== "string") return undefined;
  const t = u.trim();
  return t.length > 0 ? t : undefined;
}

export function isSupabaseBackendConfigured(): boolean {
  const url = supabaseProjectUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return (
    typeof url === "string" &&
    url.length > 0 &&
    typeof key === "string" &&
    key.trim().length > 0
  );
}

export function supabaseAdmin() {
  const url = supabaseProjectUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
