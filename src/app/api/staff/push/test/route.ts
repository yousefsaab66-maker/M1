import { NextRequest, NextResponse } from "next/server";
import { sendExpoPush } from "@/lib/expo-push";
import { listStaffPushTokens } from "@/lib/push-tokens-db";
import { getStaffUserFromRequest } from "@/lib/staff-auth-request";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    const tokens = await listStaffPushTokens();
    if (tokens.length === 0) {
      return NextResponse.json(
        { ok: false, error: "no_tokens" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    await sendExpoPush(
      tokens.map((to) => ({
        to,
        title: "MUHRA · اختبار الإشعار",
        body: "Push test OK — staff alerts are working.",
        sound: "default",
        channelId: "staff-orders",
        priority: "high",
        data: { type: "staff_test" },
      })),
    );

    return NextResponse.json({ ok: true, sent: tokens.length }, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500, headers: CORS_HEADERS });
  }
}
