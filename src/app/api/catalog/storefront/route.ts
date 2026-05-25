import { NextResponse } from "next/server";
import { NO_STORE_JSON_HEADERS, STOREFRONT_JSON_CACHE_HEADERS } from "@/lib/api-cache-headers";
import { fetchStorefront } from "@/lib/storefront-query";

export const dynamic = "force-dynamic";

/** Site + collections in one R2 read (light on Workers — avoids 1102 from many parallel calls). */
export async function GET() {
  const result = await fetchStorefront();
  if (result.kind === "error") {
    return NextResponse.json({ error: result.message }, { status: 500, headers: NO_STORE_JSON_HEADERS });
  }
  return NextResponse.json(
    {
      site: result.site,
      collections: result.collections,
      journal: result.journal,
      boutiques: result.boutiques,
      catalogProducts: result.catalogProducts,
      updatedAt: result.updatedAt,
      source: result.source,
    },
    { headers: STOREFRONT_JSON_CACHE_HEADERS },
  );
}
