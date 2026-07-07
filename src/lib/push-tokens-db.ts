import { isSupabaseBackendConfigured, supabaseAdmin } from "@/lib/supabase/admin";

export type PushRole = "customer" | "staff";

export async function upsertPushToken(params: {
  token: string;
  role: PushRole;
  phone?: string | null;
  staffUser?: string | null;
  platform?: string | null;
}): Promise<boolean> {
  if (!isSupabaseBackendConfigured()) return false;
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
  return !error;
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
  const { data, error } = await sb.from("push_tokens").select("token").eq("role", "customer").eq("phone", phoneKey);
  if (error || !data) return [];
  return data.map((r) => r.token as string).filter(Boolean);
}
