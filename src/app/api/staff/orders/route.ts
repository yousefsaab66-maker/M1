import { NextRequest, NextResponse } from "next/server";
import {
  deleteOrderRemote,
  listOrdersRemote,
  updateOrderStatusRemote,
} from "@/app/actions/muhra-backend";
import type { OrderStatus } from "@/lib/commerce-types";
import { getStaffUserFromRequest } from "@/lib/staff-auth-request";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const staff = await getStaffUserFromRequest(req);
  if (!staff) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  const result = await listOrdersRemote({ staffAuthorized: true });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503, headers: CORS_HEADERS });
  }

  return NextResponse.json({ ok: true, orders: result.orders }, { headers: CORS_HEADERS });
}

export async function PATCH(req: NextRequest) {
  const staff = await getStaffUserFromRequest(req);
  if (!staff) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  try {
    const body = (await req.json()) as { id?: string; status?: OrderStatus };
    if (!body.id || !body.status) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400, headers: CORS_HEADERS });
    }

    const ok = await updateOrderStatusRemote(body.id, body.status, { staffAuthorized: true });
    return NextResponse.json(
      { ok },
      { status: ok ? 200 : 400, headers: CORS_HEADERS },
    );
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function DELETE(req: NextRequest) {
  const staff = await getStaffUserFromRequest(req);
  if (!staff) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400, headers: CORS_HEADERS });
  }

  const ok = await deleteOrderRemote(id, { staffAuthorized: true });
  return NextResponse.json({ ok }, { status: ok ? 200 : 400, headers: CORS_HEADERS });
}
