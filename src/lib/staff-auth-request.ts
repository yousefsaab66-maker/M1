import { cookies } from "next/headers";
import { STAFF_COOKIE_NAME, verifyStaffSession } from "@/lib/staff-session";

export async function getStaffUserFromRequest(req?: Request): Promise<string | null> {
  const secret = process.env.STAFF_COOKIE_SECRET;
  if (!secret) return null;

  if (req) {
    const auth = req.headers.get("authorization");
    if (auth?.startsWith("Bearer ")) {
      const user = verifyStaffSession(auth.slice(7), secret);
      if (user) return user;
    }
  }

  const jar = await cookies();
  return verifyStaffSession(jar.get(STAFF_COOKIE_NAME)?.value, secret);
}
