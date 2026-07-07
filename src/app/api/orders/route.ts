import { NextRequest, NextResponse } from "next/server";
import { createOrderRemote } from "@/app/actions/muhra-backend";
import type { PlaceOrderInput } from "@/lib/commerce-types";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

type OrderLineInput = {
  productId: string;
  qty: number;
  size?: string;
  customerNote?: string;
  priceSlotIndex?: number;
  productOptionSlotIndex?: number;
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      customer?: PlaceOrderInput["customer"];
      payment?: PlaceOrderInput["payment"];
      discountCode?: string;
      lines?: OrderLineInput[];
    };

    if (!body.customer || !body.payment || !Array.isArray(body.lines)) {
      return NextResponse.json(
        { ok: false, error: "invalid_body" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const result = await createOrderRemote(
      {
        customer: body.customer,
        payment: body.payment,
        discountCode: body.discountCode,
      },
      body.lines,
      "app",
    );

    if (!result.ok) {
      const status =
        result.error === "rate_limited"
          ? 429
          : result.error === "not_configured"
            ? 503
            : result.error === "not_deployed"
              ? 404
              : 400;
      return NextResponse.json(result, { status, headers: CORS_HEADERS });
    }

    return NextResponse.json(result, { status: 200, headers: CORS_HEADERS });
  } catch {
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
