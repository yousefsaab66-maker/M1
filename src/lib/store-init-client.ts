/** Skip duplicate catalog/bootstrap Worker calls on rapid reload (sessionStorage survives reload). */
export const STORE_INIT_SKIP_MS = 5 * 60 * 1000;
/** Staff bootstrap client + skip window — fresh after mutation bust, else 60s (CF 1102). */
export const STAFF_BOOTSTRAP_CACHE_MS = 60 * 1000;
/** Legacy constant — background revalidate window on staff path. */
export const STAFF_INIT_SKIP_MS = 2 * 60 * 1000;
/** Debounce targeted CDN purge after staff save/delete (batch rapid edits). */
export const PURGE_DEBOUNCE_MS = 30 * 1000;
/** Debounce background revalidate so reload #2–3 do not each hit the Worker (CF 1102). */
export const BACKGROUND_REVALIDATE_DEBOUNCE_MS = 2_500;
/** Staff tab focus/visibility — bust bootstrap cache then refresh (cross-device sync). */
export const STAFF_VISIBILITY_REFRESH_DEBOUNCE_MS = 4_000;
/** Lightweight staff bootstrap poll while tab visible (cross-device; not realtime). */
export const STAFF_BACKGROUND_POLL_MS = 45_000;

const KEY_CATALOG_LOCAL_EDIT = "muhra-catalog-local-edit-v1";
const KEY_CATALOG_MUTATION_AT = "muhra-catalog-mutation-at-v1";
/** Bust CDN catalog/bootstrap fetches after staff save/delete (covers edge TTL + SWR). */
export const CATALOG_MUTATION_BUST_MS = 10 * 60 * 1000;

let catalogLocalEditCounter = 0;
let backgroundRevalidateTimer: ReturnType<typeof setTimeout> | null = null;

function hydrateCatalogLocalEditFromStorage(): number {
  if (typeof window === "undefined") return catalogLocalEditCounter;
  try {
    const stored = Number(sessionStorage.getItem(KEY_CATALOG_LOCAL_EDIT)) || 0;
    catalogLocalEditCounter = Math.max(catalogLocalEditCounter, stored);
  } catch {
    /* ignore */
  }
  return catalogLocalEditCounter;
}

/** Staff save/delete — cancel pending bg revalidate and block stale CDN from overwriting local UI. */
export function bumpCatalogLocalEdit(): number {
  catalogLocalEditCounter += 1;
  cancelScheduledBackgroundRevalidate();
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(KEY_CATALOG_LOCAL_EDIT, String(catalogLocalEditCounter));
    } catch {
      /* ignore */
    }
  }
  return catalogLocalEditCounter;
}

export function readCatalogLocalEdit(): number {
  return hydrateCatalogLocalEditFromStorage();
}

/** Force cache-busting catalog GETs while edge may still serve pre-delete JSON. */
export function shouldBustCatalogFetchAfterMutation(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const at = Number(sessionStorage.getItem(KEY_CATALOG_MUTATION_AT)) || 0;
    return at > 0 && Date.now() - at < CATALOG_MUTATION_BUST_MS;
  } catch {
    return false;
  }
}

export function scheduleBackgroundRevalidateTimer(fn: () => void): void {
  cancelScheduledBackgroundRevalidate();
  backgroundRevalidateTimer = setTimeout(() => {
    backgroundRevalidateTimer = null;
    fn();
  }, BACKGROUND_REVALIDATE_DEBOUNCE_MS);
}

export function cancelScheduledBackgroundRevalidate(): void {
  if (backgroundRevalidateTimer !== null) {
    clearTimeout(backgroundRevalidateTimer);
    backgroundRevalidateTimer = null;
  }
}

const KEY_STORE_INIT_AT = "muhra-store-init-at-v1";
const KEY_STAFF_INIT_AT = "muhra-staff-init-at-v1";
const KEY_INIT_PENDING_AT = "muhra-store-init-pending-at-v1";
const KEY_BG_REVALIDATE_AT = "muhra-bg-revalidate-at-v1";
/** If reload happens while first init is still in flight, skip duplicate full bootstrap. */
const PENDING_INIT_GRACE_MS = 30_000;

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
    sessionStorage.removeItem(KEY_INIT_PENDING_AT);
  } catch {
    /* ignore */
  }
}

/** Mark init started before network returns — rapid reload during first fetch skips duplicate bootstrap. */
export function markStoreNetworkInitPending() {
  if (typeof window === "undefined") return;
  try {
    if (!sessionStorage.getItem(KEY_INIT_PENDING_AT)) {
      sessionStorage.setItem(KEY_INIT_PENDING_AT, String(Date.now()));
    }
  } catch {
    /* ignore */
  }
}

export function shouldSkipDueToPendingInit(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const pending = Number(sessionStorage.getItem(KEY_INIT_PENDING_AT)) || 0;
    if (pending === 0) return false;
    const completed = readStoreNetworkInitAt();
    if (completed >= pending) return false;
    return Date.now() - pending < PENDING_INIT_GRACE_MS;
  } catch {
    return false;
  }
}

export function shouldSkipStoreNetworkInit(): boolean {
  const at = readStoreNetworkInitAt();
  return at > 0 && Date.now() - at < STORE_INIT_SKIP_MS;
}

let moduleStaffInitAt = 0;

export function readStaffNetworkInitAt(): number {
  if (typeof window === "undefined") return moduleStaffInitAt;
  try {
    const stored = Number(sessionStorage.getItem(KEY_STAFF_INIT_AT)) || 0;
    return Math.max(moduleStaffInitAt, stored);
  } catch {
    return moduleStaffInitAt;
  }
}

export function markStaffNetworkInitComplete() {
  const now = Date.now();
  moduleStaffInitAt = now;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY_STAFF_INIT_AT, String(now));
  } catch {
    /* ignore */
  }
}

/** Staff panel: skip duplicate in-flight init + reuse 60s bootstrap unless post-mutation bust. */
export function shouldSkipStaffNetworkInit(): boolean {
  if (shouldSkipDueToPendingInit()) return true;
  if (shouldBustCatalogFetchAfterMutation()) return false;
  const at = readStaffNetworkInitAt();
  return at > 0 && Date.now() - at < STAFF_BOOTSTRAP_CACHE_MS;
}

/**
 * Throttled reloads: revalidate catalog at most once per init window (not every reload).
 * Keeps ghost-product fix from e51dc90 without 3× Worker CPU on rapid refresh.
 */
export function shouldRunBackgroundRevalidate(staffPath: boolean): boolean {
  const initAt = readStoreNetworkInitAt();
  if (initAt === 0) return false;
  const skipWindow = staffPath ? STAFF_INIT_SKIP_MS : STORE_INIT_SKIP_MS;
  if (Date.now() - initAt >= skipWindow) return false;
  try {
    const bgAt = Number(sessionStorage.getItem(KEY_BG_REVALIDATE_AT)) || 0;
    return bgAt < initAt;
  } catch {
    return false;
  }
}

export function markBackgroundRevalidateComplete() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY_BG_REVALIDATE_AT, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** After staff save/delete — skip stale bg revalidate until next init window. */
export function markStaffCatalogMutationComplete() {
  markBackgroundRevalidateComplete();
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY_CATALOG_MUTATION_AT, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** One in-flight init per tab — concurrent mounts share the same promise. */
export function runStoreInitSingleFlight(fn: () => Promise<void>): Promise<void> {
  if (catalogInitInFlight) return catalogInitInFlight;
  catalogInitInFlight = fn().finally(() => {
    catalogInitInFlight = null;
  });
  return catalogInitInFlight;
}
