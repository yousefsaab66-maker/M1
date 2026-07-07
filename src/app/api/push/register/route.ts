import { NextRequest, NextResponse } from "next/server";
import { isIraqCountry, normalizeIraqiPhone } from "@/lib/iraq";
import { upsertPushToken } from "@/lib/push-tokens-db";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

function normalizePhoneKey(phone: string, country?: string): string {
  if (isIraqCountry(country)) {
    return normalizeIraqiPhone(phone) ?? phone.replace(/\D/g, "");
  }
  return phone.replace(/[\s\-().]/g, "");
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      token?: string;
      phone?: string;
      country?: string;
      platform?: string;
    };

    if (!body.token?.trim()) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400, headers: CORS_HEADERS });
    }

    const phoneKey = body.phone?.trim() ? normalizePhoneKey(body.phone, body.country ?? "IQ") : null;

    const ok = await upsertPushToken({
      token: body.token,
      role: "customer",
      phone: phoneKey,
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
  try {
    const body = (await req.json()) as { token?: string };
    if (!body.token?.trim()) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400, headers: CORS_HEADERS });
    }
    const { deletePushToken } = await import("@/lib/push-tokens-db");
    await deletePushToken(body.token);
    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500, headers: CORS_HEADERS });
  }
}
