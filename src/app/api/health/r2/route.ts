import { NextResponse } from "next/server";
import { getMuhraMediaR2Binding } from "@/lib/r2-upload";

export const dynamic = "force-dynamic";

/** Does not expose URLs — only whether the Worker can write to R2 and serve via a configured public base. */
export async function GET() {
  const r2PublicBase = process.env.R2_PUBLIC_BASE_URL?.trim();
  const bucket = await getMuhraMediaR2Binding();
  const ready = Boolean(bucket && r2PublicBase);
  return NextResponse.json({ ready }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
