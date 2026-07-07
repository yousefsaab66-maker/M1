import { NextRequest, NextResponse } from "next/server";
import type { Product } from "@/lib/catalog";
import { invalidateCatalogProductsCache } from "@/lib/catalog-products-query";
import { purgeCloudflareCatalogCache } from "@/lib/cloudflare-purge";
import { deleteProductFromSupabase } from "@/lib/muhra-product-delete";
import { upsertProductToSupabase } from "@/lib/muhra-product-upsert";
import { scheduleRefreshStorefrontCatalogInR2 } from "@/lib/storefront-r2";
import { getStaffUserFromRequest } from "@/lib/staff-auth-request";
import { STAFF_CORS_HEADERS } from "@/lib/staff-cors";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: STAFF_CORS_HEADERS });
}

/** Staff product save — avoids Next Server Action overhead on Cloudflare Workers (1102). */
export async function POST(req: NextRequest) {
  const staff = await getStaffUserFromRequest(req);
  if (!staff) {
    return NextResponse.json({ ok: false, error: "unauthorized" } as const, {
      status: 401,
      headers: STAFF_CORS_HEADERS,
    });
  }

  let payload: Product;
  try {
    payload = (await req.json()) as Product;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" } as const, {
      status: 400,
      headers: STAFF_CORS_HEADERS,
    });
  }

  const result = await upsertProductToSupabase(payload);
  if (result.ok) {
    invalidateCatalogProductsCache();
    scheduleRefreshStorefrontCatalogInR2();
    void purgeCloudflareCatalogCache().catch(() => {});
  }
  return NextResponse.json(result, { headers: STAFF_CORS_HEADERS });
}

/** Staff product delete — avoids Next Server Action overhead on Cloudflare Workers (1102). */
export async function DELETE(req: NextRequest) {
  const staff = await getStaffUserFromRequest(req);
  if (!staff) {
    return NextResponse.json({ ok: false, error: "unauthorized" } as const, {
      status: 401,
      headers: STAFF_CORS_HEADERS,
    });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing_id" } as const, {
      status: 400,
      headers: STAFF_CORS_HEADERS,
    });
  }

  const result = await deleteProductFromSupabase(id);
  if (result.ok) {
    invalidateCatalogProductsCache();
    scheduleRefreshStorefrontCatalogInR2();
    void purgeCloudflareCatalogCache().catch(() => {});
  }
  if (!result.ok) {
    const status =
      result.error === "not_configured"
        ? 503
        : result.error === "invalid_id" || result.error === "not_found"
          ? 400
          : 500;
    return NextResponse.json({ ok: false, error: result.error } as const, {
      status,
      headers: STAFF_CORS_HEADERS,
    });
  }
  return NextResponse.json({ ok: true } as const, { headers: STAFF_CORS_HEADERS });
}
