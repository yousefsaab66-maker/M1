import {
  BOUTIQUES as SEED_BOUTIQUES,
  COLLECTIONS as SEED_COLLECTIONS,
  JOURNAL as SEED_JOURNAL,
  SITE_CONTENT as SEED_SITE,
  type Boutique,
  type Collection,
  type JournalArticle,
  type SiteContent,
} from "@/lib/catalog";
import { normalizeSiteContent } from "@/lib/site-display";
import { readStorefrontFromR2, writeStorefrontToR2 } from "@/lib/storefront-r2";

export type FetchStorefrontResult =
  | {
      kind: "ok";
      site: SiteContent | null;
      collections: Collection[] | null;
      journal: JournalArticle[] | null;
      boutiques: Boutique[] | null;
      updatedAt: string | null;
      source: "r2" | "none";
    }
  | { kind: "error"; message: string };

export type UpsertStorefrontPatch = {
  site?: SiteContent;
  collections?: Collection[];
  journal?: JournalArticle[];
  boutiques?: Boutique[];
};

export type UpsertStorefrontResult = { ok: true; updatedAt: string } | { ok: false; error: string };

export async function fetchStorefront(): Promise<FetchStorefrontResult> {
  const r2 = await readStorefrontFromR2();
  if (r2.ok && r2.data) {
    return {
      kind: "ok",
      site: r2.data.site,
      collections: r2.data.collections,
      journal: r2.data.journal,
      boutiques: r2.data.boutiques,
      updatedAt: r2.data.updatedAt,
      source: "r2",
    };
  }
  if (r2.ok === false && r2.error === "r2_read_failed") {
    return { kind: "error", message: r2.error };
  }
  return {
    kind: "ok",
    site: null,
    collections: null,
    journal: null,
    boutiques: null,
    updatedAt: null,
    source: "none",
  };
}

export async function upsertStorefront(patch: UpsertStorefrontPatch): Promise<UpsertStorefrontResult> {
  const r2 = await writeStorefrontToR2(patch);
  if (r2.ok) return r2;
  return { ok: false, error: r2.error };
}

export async function upsertSiteContent(site: SiteContent): Promise<UpsertStorefrontResult> {
  return upsertStorefront({ site });
}

export async function upsertCollectionsContent(collections: Collection[]): Promise<UpsertStorefrontResult> {
  return upsertStorefront({ collections });
}

/** @deprecated Use fetchStorefront */
export async function fetchSiteContent() {
  const r = await fetchStorefront();
  if (r.kind === "error") return { kind: "error" as const, message: r.message };
  return {
    kind: "ok" as const,
    site: r.site ?? normalizeSiteContent(SEED_SITE),
    updatedAt: r.updatedAt,
  };
}

export { SEED_COLLECTIONS, SEED_SITE };
