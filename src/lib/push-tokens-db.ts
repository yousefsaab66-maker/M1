import { isSupabaseBackendConfigured, supabaseAdmin } from "@/lib/supabase/admin";

export type PushRole = "customer" | "staff";

export type PushTokenUpsertResult =
  | { ok: true }
  | { ok: false; error: "not_configured" | "db_error"; detail?: string };

export async function upsertPushToken(params: {
  token: string;
  role: PushRole;
  phone?: string | null;
  staffUser?: string | null;
  platform?: string | null;
}): Promise<PushTokenUpsertResult> {
  if (!isSupabaseBackendConfigured()) return { ok: false, error: "not_configured" };
  try {
    const sb = supabaseAdmin();
    const row = {
      token: params.token.trim(),
      role: params.role,
      phone: params.phone?.trim() || null,
      staff_user: params.staffUser?.trim() || null,
      platform: params.platform?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await sb.from("push_tokens").upsert(row, { onConflict: "token" });
    if (error) return { ok: false, error: "db_error", detail: error.message };
    return { ok: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    return { ok: false, error: "db_error", detail };
  }
}

export async function deletePushToken(token: string): Promise<void> {
  if (!isSupabaseBackendConfigured()) return;
  const sb = supabaseAdmin();
  await sb.from("push_tokens").delete().eq("token", token.trim());
}

export async function deletePushTokens(tokens: string[]): Promise<void> {
  if (!isSupabaseBackendConfigured() || tokens.length === 0) return;
  const sb = supabaseAdmin();
  await sb.from("push_tokens").delete().in("token", tokens.map((t) => t.trim()));
}

export async function listStaffPushTokens(): Promise<string[]> {
  if (!isSupabaseBackendConfigured()) return [];
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("push_tokens").select("token").eq("role", "staff");
  if (error || !data) return [];
  return data.map((r) => r.token as string).filter(Boolean);
}

export async function listCustomerPushTokensForPhone(phoneKey: string): Promise<string[]> {
  if (!isSupabaseBackendConfigured() || !phoneKey) return [];
  const sb = supabaseAdmin();

  const keys = new Set<string>([phoneKey.trim()]);
  if (phoneKey.startsWith("+964")) {
    keys.add(phoneKey.slice(1));
    keys.add(phoneKey.replace("+964", "964"));
  } else if (phoneKey.startsWith("964")) {
    keys.add(`+${phoneKey}`);
    keys.add(`0${phoneKey.slice(3)}`);
  } else if (phoneKey.startsWith("07")) {
    keys.add(`+964${phoneKey.slice(1)}`);
    keys.add(`964${phoneKey.slice(1)}`);
  }

  const { data, error } = await sb
    .from("push_tokens")
    .select("token")
    .eq("role", "customer")
    .in("phone", [...keys]);
  if (error || !data) return [];
  return [...new Set(data.map((r) => r.token as string).filter(Boolean))];
}
