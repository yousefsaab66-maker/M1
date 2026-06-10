type StaffSessionGetResult = { ok: boolean; user: string | null };

let staffSessionGetInFlight: Promise<StaffSessionGetResult> | null = null;

/** Dedupes concurrent GET /api/staff/session during one page load (AuthProvider + login redirect). */
export function fetchStaffSessionGet(): Promise<StaffSessionGetResult> {
  if (!staffSessionGetInFlight) {
    staffSessionGetInFlight = (async () => {
      try {
        const res = await fetch("/api/staff/session", { credentials: "include" });
        const body = (await res.json()) as { ok?: boolean; user?: string | null };
        if (res.ok && body.ok && body.user) return { ok: true, user: body.user };
        return { ok: false, user: null };
      } catch {
        return { ok: false, user: null };
      }
    })().finally(() => {
      staffSessionGetInFlight = null;
    });
  }
  return staffSessionGetInFlight;
}
