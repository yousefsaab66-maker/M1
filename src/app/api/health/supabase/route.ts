import { NextResponse } from "next/server";
import { isSupabaseBackendConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Lightweight — tells the client whether server env can talk to Supabase (does not authenticate). */
export async function GET() {
  const ready = isSupabaseBackendConfigured();
  return NextResponse.json({ ready }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
