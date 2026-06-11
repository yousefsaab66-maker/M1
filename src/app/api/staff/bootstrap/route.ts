import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { NO_STORE_JSON_HEADERS, STAFF_BOOTSTRAP_JSON_CACHE_HEADERS } from "@/lib/api-cache-headers";
import { fetchCatalogProductsForList } from "@/lib/catalog-products-query";
import { isR2PresignConfigured } from "@/lib/r2-presign";
import { getR2StaffContext } from "@/lib/r2-staff-context";
import { readStorefrontFromR2, type ReadStorefrontR2Result } from "@/lib/storefront-r2";
import { STAFF_COOKIE_NAME, verifyStaffSession } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

async function requireStaff(): Promise<boolean> {
  const secret = process.env.STAFF_COOKIE_SECRET;
  const jar = await cookies();
  return Boolean(verifyStaffSession(jar.get(STAFF_COOKIE_NAME)?.value, secret));
}

async function readStorefrontSafe(): Promise<ReadStorefrontR2Result> {
  try {
    return await readStorefrontFromR2();
  } catch {
    return { ok: false, error: "r2_read_failed" };
  }
}

/**
 * Staff init — list products + site/collections only (no journal/boutiques bodies).
 * Parallel Supabase + R2 + upload gate; includes presign flag so the client skips `/api/health/r2`.
 */
export async function GET() {
  if (!(await requireStaff())) {
    return NextResponse.json(
      {
        products: [],
        productsError: "unauthorized",
        site: null,
        collections: null,
        storefrontUpdatedAt: null,
        storefrontSource: "none" as const,
        r2Ready: false,
        presignConfigured: false,
      },
      { status: 401, headers: NO_STORE_JSON_HEADERS },
    );
  }

  const [productsResult, storefrontR2, r2Ctx] = await Promise.all([
    fetchCatalogProductsForList(),
    readStorefrontSafe(),
    getR2StaffContext(),
  ]);

  const products =
    productsResult.kind === "ok" ? productsResult.products : [];
  const productsError =
    productsResult.kind === "ok"
      ? null
      : productsResult.kind === "error"
        ? productsResult.message
        : "not_configured";
  const r2Ready = r2Ctx.ready;
  const presignConfigured = isR2PresignConfigured();

  if (storefrontR2.ok && storefrontR2.data) {
    return NextResponse.json(
      {
        products,
        productsError,
        site: storefrontR2.data.site,
        collections: storefrontR2.data.collections,
        storefrontUpdatedAt: storefrontR2.data.updatedAt,
        storefrontSource: "r2" as const,
        r2Ready,
        presignConfigured,
      },
      { headers: STAFF_BOOTSTRAP_JSON_CACHE_HEADERS },
    );
  }

  return NextResponse.json(
    {
      products,
      productsError,
      site: null,
      collections: null,
      storefrontUpdatedAt: null,
      storefrontSource: "none" as const,
      r2Ready,
      presignConfigured,
    },
    { headers: STAFF_BOOTSTRAP_JSON_CACHE_HEADERS },
  );
}
