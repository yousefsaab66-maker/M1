import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { fetchCatalogProducts } from "@/lib/catalog-products-query";
import { NO_STORE_JSON_HEADERS } from "@/lib/api-cache-headers";
import { productHasEmbeddedImages } from "@/lib/product-media";
import { STAFF_COOKIE_NAME, verifyStaffSession } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

async function requireStaff(): Promise<boolean> {
  const secret = process.env.STAFF_COOKIE_SECRET;
  const jar = await cookies();
  return Boolean(verifyStaffSession(jar.get(STAFF_COOKIE_NAME)?.value, secret));
}

/** Staff diagnostic: products whose DB rows still contain inline base64 images. */
export async function GET() {
  if (!(await requireStaff())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE_JSON_HEADERS });
  }
  const result = await fetchCatalogProducts({ rawImages: true });
  if (result.kind !== "ok") {
    return NextResponse.json(
      { error: result.kind === "not_configured" ? "not_configured" : result.message },
      { status: result.kind === "not_configured" ? 503 : 500, headers: NO_STORE_JSON_HEADERS },
    );
  }
  const embedded = result.products
    .filter(productHasEmbeddedImages)
    .map((p) => ({ id: p.id, slug: p.slug, name: p.name }));
  return NextResponse.json({ count: embedded.length, products: embedded }, { headers: NO_STORE_JSON_HEADERS });
}
