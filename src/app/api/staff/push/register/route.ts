import { NextRequest, NextResponse } from "next/server";
import { upsertPushToken, deletePushToken } from "@/lib/push-tokens-db";
import { getStaffUserFromRequest } from "@/lib/staff-auth-request";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const staff = await getStaffUserFromRequest(req);
  if (!staff) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  try {
    const body = (await req.json()) as { token?: string; platform?: string };
    if (!body.token?.trim()) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400, headers: CORS_HEADERS });
    }

    const ok = await upsertPushToken({
      token: body.token,
      role: "staff",
      staffUser: staff,
      platform: body.platform,
    });

    if (!ok) {
      return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503, headers: CORS_HEADERS });
    }

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function DELETE(req: NextRequest) {
  const staff = await getStaffUserFromRequest(req);
  if (!staff) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  try {
    const body = (await req.json()) as { token?: string };
    if (!body.token?.trim()) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400, headers: CORS_HEADERS });
    }
    await deletePushToken(body.token);
    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500, headers: CORS_HEADERS });
  }
}
