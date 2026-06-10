import { CLIENT_CACHE_MS } from "@/lib/storefront-client";

const KEY_STORE_INIT_AT = "muhra-store-init-at-v1";

let moduleInitAt = 0;
let catalogInitInFlight: Promise<void> | null = null;

export function readStoreNetworkInitAt(): number {
  if (typeof window === "undefined") return moduleInitAt;
  try {
    const stored = Number(sessionStorage.getItem(KEY_STORE_INIT_AT)) || 0;
    return Math.max(moduleInitAt, stored);
  } catch {
    return moduleInitAt;
  }
}

export function markStoreNetworkInitComplete() {
  const now = Date.now();
  moduleInitAt = now;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY_STORE_INIT_AT, String(now));
  } catch {
    /* ignore */
  }
}

/** Skip duplicate catalog/bootstrap Worker calls on rapid reload (sessionStorage survives reload). */
export function shouldSkipStoreNetworkInit(): boolean {
  const at = readStoreNetworkInitAt();
  return at > 0 && Date.now() - at < CLIENT_CACHE_MS;
}

/** One in-flight init per tab — concurrent mounts share the same promise. */
export function runStoreInitSingleFlight(fn: () => Promise<void>): Promise<void> {
  if (catalogInitInFlight) return catalogInitInFlight;
  catalogInitInFlight = fn().finally(() => {
    catalogInitInFlight = null;
  });
  return catalogInitInFlight;
}
