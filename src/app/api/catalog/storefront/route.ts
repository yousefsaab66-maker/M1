import { NextResponse } from "next/server";
import { fetchStorefront } from "@/lib/storefront-query";

export const dynamic = "force-dynamic";

const STOREFRONT_JSON_CACHE = {
  "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
  "CDN-Cache-Control": "max-age=60",
} as const;

const NO_STORE_JSON = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
} as const;

/** Site + collections in one R2 read (light on Workers — avoids 1102 from many parallel calls). */
export async function GET() {
  const result = await fetchStorefront();
  if (result.kind === "error") {
    return NextResponse.json({ error: result.message }, { status: 500, headers: NO_STORE_JSON });
  }
  return NextResponse.json(
    {
      site: result.site,
      collections: result.collections,
      journal: result.journal,
      boutiques: result.boutiques,
      updatedAt: result.updatedAt,
      source: result.source,
    },
    { headers: STOREFRONT_JSON_CACHE },
  );
}
