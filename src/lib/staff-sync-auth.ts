import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { STAFF_COOKIE_NAME, verifyStaffSession } from "@/lib/staff-session";

function secretsMatch(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/** CLI / automation — `Authorization: Bearer …` or `X-Staff-Sync-Secret`. */
export function verifyStaffSyncSecret(header: string | null | undefined): boolean {
  const expected = process.env.STAFF_SYNC_SECRET?.trim();
  if (!expected || expected.length < 16 || !header?.trim()) return false;
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
  if (!token) return false;
  return secretsMatch(token, expected);
}

/** Staff cookie session or one-time sync secret (for `npm run sync-catalog-r2` against production). */
export async function isStaffAuthorized(request?: Request): Promise<boolean> {
  const cookieSecret = process.env.STAFF_COOKIE_SECRET;
  const jar = await cookies();
  if (verifyStaffSession(jar.get(STAFF_COOKIE_NAME)?.value, cookieSecret)) return true;
  if (!request) return false;
  if (verifyStaffSyncSecret(request.headers.get("authorization"))) return true;
  if (verifyStaffSyncSecret(request.headers.get("x-staff-sync-secret"))) return true;
  return false;
}
