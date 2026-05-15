import { NextResponse } from "next/server";
import { getR2StaffContext } from "@/lib/r2-staff-context";

export const dynamic = "force-dynamic";

/** Whether staff cloud upload can succeed (binding + public base). */
export async function GET() {
  const ctx = await getR2StaffContext();
  return NextResponse.json(
    {
      ready: ctx.ready,
      error: ctx.ready ? null : ctx.error,
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
