/** Skip duplicate catalog/bootstrap Worker calls on rapid reload (sessionStorage survives reload). */
export const STORE_INIT_SKIP_MS = 5 * 60 * 1000;
/** Staff panel — shorter skip window; still fresh on first open, avoids bootstrap spam on reload (CF 1102). */
export const STAFF_INIT_SKIP_MS = 2 * 60 * 1000;

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

export function shouldSkipStoreNetworkInit(): boolean {
  const at = readStoreNetworkInitAt();
  return at > 0 && Date.now() - at < STORE_INIT_SKIP_MS;
}

export function shouldSkipStaffNetworkInit(): boolean {
  const at = readStoreNetworkInitAt();
  return at > 0 && Date.now() - at < STAFF_INIT_SKIP_MS;
}

/** One in-flight init per tab — concurrent mounts share the same promise. */
export function runStoreInitSingleFlight(fn: () => Promise<void>): Promise<void> {
  if (catalogInitInFlight) return catalogInitInFlight;
  catalogInitInFlight = fn().finally(() => {
    catalogInitInFlight = null;
  });
  return catalogInitInFlight;
}
