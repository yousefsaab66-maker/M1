import type { Product } from "@/lib/catalog";

/** Cross-tab catalog mirror — localStorage + BroadcastChannel (storage event skips origin tab). */
export const KEY_CATALOG_CROSS_TAB = "muhra-catalog-cross-tab-v1";
export const KEY_CATALOG_SNAPSHOT = "muhra-remote-catalog-snapshot-v1";
export const KEY_PRODUCTS = "muhra-products-v1";

const CHANNEL_NAME = "muhra-catalog-sync-v1";

export type CatalogCrossTabPayload = {
  at: number;
  products: Product[];
  /** Explicit deletes — receivers must not treat a shorter product list as authoritative. */
  deletedIds?: string[];
};

export type BroadcastCatalogOpts = {
  deletedIds?: string[];
};

/** Union-merge incoming with current; never drop DB products missing from a stale partial broadcast. */
export function mergeCrossTabCatalogProducts(
  current: Product[],
  incoming: Product[],
  deletedIds?: string[],
): Product[] {
  const byId = new Map(current.map((p) => [p.id, p]));
  for (const p of incoming) byId.set(p.id, p);
  if (deletedIds?.length) {
    for (const id of deletedIds) byId.delete(id);
  }
  return [...byId.values()];
}

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (!("BroadcastChannel" in window)) return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      return null;
    }
  }
  return channel;
}

/** Drop legacy local product list only — keep session snapshot (post-delete F5 relies on it). */
export function clearStaleLocalProductListCache(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY_PRODUCTS);
  } catch {
    /* ignore */
  }
}

export function readCrossTabCatalog(): CatalogCrossTabPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY_CATALOG_CROSS_TAB);
    if (!raw) return null;
    const p = JSON.parse(raw) as CatalogCrossTabPayload;
    if (!p || !Array.isArray(p.products) || typeof p.at !== "number") return null;
    return p;
  } catch {
    return null;
  }
}

/** Notify other tabs (and persist for tabs opened later) after staff save/delete. */
export function broadcastCatalogProducts(products: Product[], opts?: BroadcastCatalogOpts): number {
  if (typeof window === "undefined") return 0;
  const payload: CatalogCrossTabPayload = {
    at: Date.now(),
    products,
    ...(opts?.deletedIds?.length ? { deletedIds: opts.deletedIds } : {}),
  };
  try {
    localStorage.setItem(KEY_CATALOG_CROSS_TAB, JSON.stringify(payload));
  } catch {
    /* quota */
  }
  try {
    getChannel()?.postMessage(payload);
  } catch {
    /* ignore */
  }
  return payload.at;
}

export function subscribeCatalogCrossTab(
  onUpdate: (payload: CatalogCrossTabPayload) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const handle = (payload: CatalogCrossTabPayload) => {
    if (!payload?.products || !Array.isArray(payload.products) || typeof payload.at !== "number") {
      return;
    }
    onUpdate(payload);
  };

  const ch = getChannel();
  const onMessage = (e: MessageEvent) => handle(e.data as CatalogCrossTabPayload);
  ch?.addEventListener("message", onMessage);

  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY_CATALOG_CROSS_TAB || !e.newValue) return;
    try {
      handle(JSON.parse(e.newValue) as CatalogCrossTabPayload);
    } catch {
      /* ignore */
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    ch?.removeEventListener("message", onMessage);
    window.removeEventListener("storage", onStorage);
  };
}
