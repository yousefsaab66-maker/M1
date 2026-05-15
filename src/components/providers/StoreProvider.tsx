"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BOUTIQUES as SEED_BOUTIQUES,
  COLLECTIONS as SEED_COLLECTIONS,
  JOURNAL as SEED_JOURNAL,
  PRODUCTS as SEED_PRODUCTS,
  SITE_CONTENT as SEED_SITE,
  type Boutique,
  type Collection,
  type Currency,
  type JournalArticle,
  type Product,
  type SiteContent,
} from "@/lib/catalog";
import type { BagItem, Order, OrderStatus, PlaceOrderInput } from "@/lib/commerce-types";
import { SHIPPING_FEE_IQD, toIqd, type GovernorateCode } from "@/lib/iraq";
import { normalizeSiteContent } from "@/lib/site-display";
import { sanitizeSiteContentForServer } from "@/lib/site-content-storage";
import { fetchStorefrontForClient } from "@/lib/storefront-client";

export type {
  BagItem,
  OrderStatus,
  PaymentMethod,
  OrderCustomer,
  OrderPayment,
  Order,
  PlaceOrderInput,
} from "@/lib/commerce-types";
export type { GovernorateCode };

const KEY_PRODUCTS = "muhra-products-v1";
/** آخر كتالوج ناجح من الـ API — يمنع الرجوع للـ SEED عند فشل Cloudflare/1102 بعد مسح localStorage */
const KEY_CATALOG_SNAPSHOT = "muhra-remote-catalog-snapshot-v1";
const KEY_COLLECTIONS = "muhra-collections-v1";
const KEY_JOURNAL = "muhra-journal-v1";
const KEY_BOUTIQUES = "muhra-boutiques-v3";
const KEY_SITE = "muhra-site-v1";
const KEY_SITE_REMOTE_AT = "muhra-site-remote-at-v1";
const KEY_BAG = "muhra-bag-v1";
const KEY_WISH = "muhra-wishlist-v1";
const KEY_ORDERS = "muhra-orders-v1";
const KEY_USER = "muhra-user-v1";

export interface UserProfile {
  name: string;
  email?: string;
  signedInAt: string;
}

type StoreCtx = {
  products: Product[];
  collections: Collection[];
  journal: JournalArticle[];
  boutiques: Boutique[];
  site: SiteContent;
  setProducts: (p: Product[]) => void;
  setCollections: (c: Collection[]) => void;
  setJournal: (j: JournalArticle[]) => void;
  setBoutiques: (b: Boutique[]) => void;
  setSite: (s: SiteContent) => void;
  /** حفظ إعدادات الموقع في Supabase + التخزين المحلي (للظهور على كل الأجهزة). */
  saveSite: (s: SiteContent) => Promise<{ ok: true } | { ok: false; error: string }>;
  saveCollections: (c: Collection[]) => Promise<{ ok: true } | { ok: false; error: string }>;
  refreshStorefront: () => Promise<void>;
  resetCatalog: () => void;

  bag: BagItem[];
  addToBag: (p: { productId: string; size?: string; qty?: number }) => void;
  removeFromBag: (productId: string, size?: string) => void;
  setBagQty: (productId: string, qty: number, size?: string) => void;
  clearBag: () => void;
  bagCount: number;

  wishlist: string[];
  toggleWish: (productId: string) => void;
  inWishlist: (productId: string) => boolean;

  /** وضع الكتالوج عبر Supabase (متغيرات بيئة عامة). */
  remoteCatalog: boolean;
  /** السيرفر يملك مفاتيح Supabase — للحفظ والرفع حتى لو فشل جلب قائمة المنتجات لحظياً. */
  supabaseReady: boolean;
  /** Worker مربوط بـ R2 مع عنوان عام — رفع الوسائط بدون الاعتماد على Supabase Storage. */
  r2Ready: boolean;
  refreshCatalog: () => Promise<void>;
  /** بعد حفظ منتج عبر API — يحدّث القائمة واللقطة حتى لا يختفي المنتج إذا فشل refresh (CF 1102). */
  mergeRemoteProduct: (p: Product) => void;
  pullRemoteOrders: () => Promise<void>;

  orders: Order[];
  placeDemoOrder: () => Order | null;
  placeOrder: (
    input: PlaceOrderInput,
  ) => Promise<{ ok: true; order: Order } | { ok: false; error: string }>;
  setOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  removeOrder: (id: string) => Promise<void>;

  user: UserProfile | null;
  signIn: (name: string, email?: string) => void;
  signOut: () => void;
  hydrated: boolean;
  /** أول جلب شبكة للكتالوج + الواجهة اكتمل (أو فشل). */
  storeReady: boolean;
};

const StoreContext = createContext<StoreCtx | null>(null);

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}

function readCatalogSnapshot(): Product[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY_CATALOG_SNAPSHOT);
    if (!raw) return null;
    const p = JSON.parse(raw) as Product[];
    return Array.isArray(p) && p.length > 0 ? p : null;
  } catch {
    return null;
  }
}

function writeCatalogSnapshot(products: Product[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY_CATALOG_SNAPSHOT, JSON.stringify(products));
  } catch {
    /* quota */
  }
}

/** يمنع fallback قديم في `muhra-products-v1` لو فشل طلب لاحق على الجوال وقرأ localStorage. */
function clearStaleLocalProductCache() {
  try {
    localStorage.removeItem(KEY_PRODUCTS);
  } catch {
    /* ignore */
  }
}

function catalogProductsUrl() {
  return `/api/catalog/products?_=${Date.now()}`;
}

const CATALOG_FETCH_OPTS: RequestInit = {
  cache: "no-store",
  credentials: "same-origin",
};

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** يقلل احتمال البقاء على وضع محلي بسبب فشل شبكة/حافة لحظي (جوال، CF، إعادة نشر). */
async function fetchCatalogJson(
  attempts = 3,
  signal?: AbortSignal,
): Promise<{ ok: true; products: Product[] } | { ok: false }> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const r = await fetch(catalogProductsUrl(), { ...CATALOG_FETCH_OPTS, signal });
      if (r.ok) {
        const d = (await r.json()) as { products?: Product[] };
        if (Array.isArray(d.products)) {
          return { ok: true, products: d.products };
        }
        return { ok: false };
      }
      /* أعد المحاولة لأخطاء بروكسي/انتهاء المهلة — أخطاء العميل (4xx) غالباً دائمة */
      if ((r.status === 503 || r.status === 502 || r.status === 504 || r.status === 524) && i < attempts - 1) {
        await delay(350 * (i + 1));
        continue;
      }
      return { ok: false };
    } catch (e) {
      if (signal?.aborted || (e instanceof DOMException && e.name === "AbortError")) {
        return { ok: false };
      }
      if (i < attempts - 1) {
        await delay(400 * (i + 1));
        continue;
      }
      return { ok: false };
    }
  }
  return { ok: false };
}

async function fetchStorefrontJson(signal?: AbortSignal) {
  const res = await fetchStorefrontForClient(signal);
  if (!res.ok) return { ok: false as const };
  return {
    ok: true as const,
    site: res.site,
    collections: res.collections,
    updatedAt: res.updatedAt,
    source: res.source,
  };
}

async function putStorefrontJson(
  body: { site?: SiteContent; collections?: Collection[] },
): Promise<{ ok: true; updatedAt: string } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/staff/storefront", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      updatedAt?: string;
    };
    if (res.ok && data.ok) {
      return { ok: true, updatedAt: data.updatedAt ?? new Date().toISOString() };
    }
    if (res.status === 401 || data.error === "unauthorized") return { ok: false, error: "unauthorized" };
    return { ok: false, error: typeof data.error === "string" ? data.error : "generic" };
  } catch {
    return { ok: false, error: "network" };
  }
}

/** لا نُبقي واجهة المستخدم معلّقة بانتظار Workers بطيئة أو معلّقة (أوّل تحميل قد يكون بارد على CF). */
const STORE_INIT_NETWORK_MS = 45_000;

export function StoreProvider({
  children,
  initialRemoteProducts,
}: {
  children: React.ReactNode;
  /** من `RootLayout` بعد جلب Supabase — يمنع أول طلاء بمنتجات الـ demo المدمجة. */
  initialRemoteProducts?: Product[];
}) {
  const bootstrapFromServer = initialRemoteProducts !== undefined;
  /** يُحدَّد وقت التشغيل من `/api/catalog/products` حتى يعمل الكتالوج لو غاب NEXT_PUBLIC وقت بناء الاستضافة. */
  const [remoteCatalog, setRemoteCatalog] = useState(() => bootstrapFromServer);
  const [supabaseReady, setSupabaseReady] = useState(false);
  const [r2Ready, setR2Ready] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [storeReady, setStoreReady] = useState(false);

  const [products, setProductsState] = useState<Product[]>(() => {
    if (bootstrapFromServer) return initialRemoteProducts!;
    const snap = readCatalogSnapshot();
    if (snap && snap.length > 0) return snap;
    return readJSON<Product[]>(KEY_PRODUCTS, SEED_PRODUCTS);
  });
  const [collections, setCollectionsState] = useState<Collection[]>(SEED_COLLECTIONS);
  const [journal, setJournalState] = useState<JournalArticle[]>(SEED_JOURNAL);
  const [boutiques, setBoutiquesState] = useState<Boutique[]>(SEED_BOUTIQUES);
  const [site, setSiteState] = useState<SiteContent>(() => normalizeSiteContent(SEED_SITE));

  const [bag, setBag] = useState<BagItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);

  const initialized = useRef(false);
  /** Supersedes in-flight catalog GETs so an older request cannot overwrite a newer one (init vs staff save, double refresh). */
  const catalogApplyGenRef = useRef(0);
  /** Aborts the previous `refreshCatalog` when a new one starts (visibility/online spam, staff double-clicks). */
  const catalogRefreshAbortRef = useRef<AbortController | null>(null);

  const refreshCatalog = useCallback(async () => {
    catalogRefreshAbortRef.current?.abort();
    const ac = new AbortController();
    catalogRefreshAbortRef.current = ac;
    const gen = (catalogApplyGenRef.current += 1);
    try {
      const res = await fetchCatalogJson(2, ac.signal);
      if (gen !== catalogApplyGenRef.current) return;
      if (!res.ok) return;
      writeCatalogSnapshot(res.products);
      clearStaleLocalProductCache();
      setRemoteCatalog(true);
      setProductsState(res.products);
    } finally {
      if (catalogRefreshAbortRef.current === ac) catalogRefreshAbortRef.current = null;
    }
  }, []);

  const applySite = useCallback((s: SiteContent, remoteUpdatedAt?: string | null) => {
    const next = normalizeSiteContent(s);
    setSiteState(next);
    writeJSON(KEY_SITE, next);
    if (remoteUpdatedAt) {
      try {
        localStorage.setItem(KEY_SITE_REMOTE_AT, remoteUpdatedAt);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const applyCollections = useCallback((c: Collection[]) => {
    setCollectionsState(c);
    writeJSON(KEY_COLLECTIONS, c);
  }, []);

  const applyStorefront = useCallback(
    (site: SiteContent, collections: Collection[], remoteUpdatedAt?: string | null) => {
      applySite(site, remoteUpdatedAt);
      applyCollections(collections);
    },
    [applySite, applyCollections],
  );

  const refreshStorefront = useCallback(async () => {
    try {
      const res = await fetchStorefrontJson();
      if (res.ok) {
        applyStorefront(res.site, res.collections, res.updatedAt);
        if (res.source === "r2") setR2Ready(true);
      }
    } catch {
      /* ignore */
    }
  }, [applyStorefront]);

  const mergeRemoteProduct = useCallback((p: Product) => {
    /* Bumps generation so init/refresh that started before this merge cannot overwrite fresher UI + snapshot. */
    catalogApplyGenRef.current += 1;
    setProductsState((prev) => {
      const i = prev.findIndex((x) => x.id === p.id);
      const next = i >= 0 ? prev.map((x, j) => (j === i ? p : x)) : [...prev, p];
      writeCatalogSnapshot(next);
      return next;
    });
    setRemoteCatalog(true);
  }, []);

  const pullRemoteOrders = useCallback(async () => {
    if (!supabaseReady) return;
    try {
      const { listOrdersRemote } = await import("@/app/actions/muhra-backend");
      const r = await listOrdersRemote();
      if (r.ok) setOrders(r.orders);
    } catch {
      /* ignore */
    }
  }, [supabaseReady]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const hydrateSiteAndUi = () => {
      setSiteState(normalizeSiteContent(readJSON<SiteContent>(KEY_SITE, SEED_SITE)));
      setCollectionsState(readJSON<Collection[]>(KEY_COLLECTIONS, SEED_COLLECTIONS));
      setJournalState(readJSON<JournalArticle[]>(KEY_JOURNAL, SEED_JOURNAL));
      setBoutiquesState(readJSON<Boutique[]>(KEY_BOUTIQUES, SEED_BOUTIQUES));
      setBag(readJSON<BagItem[]>(KEY_BAG, []));
      setWishlist(readJSON<string[]>(KEY_WISH, []));
      setUser(readJSON<UserProfile | null>(KEY_USER, null));
      setHydrated(true);
      setStoreReady(true);
    };

    const applyLocalCatalogFromStorage = () => {
      setRemoteCatalog(false);
      setProductsState(readJSON<Product[]>(KEY_PRODUCTS, SEED_PRODUCTS));
      setOrders(readJSON<Order[]>(KEY_ORDERS, []));
    };

    /** إن فشل الـ API: لا نرجع للـ SEED إذا عندنا لقطة من آخر تحميل ناجح (يحدث مع 1102 بعد مسح muhra-products-v1). */
    const recoverCatalogAfterNetworkFailure = () => {
      const snap = readCatalogSnapshot();
      if (snap && snap.length > 0) {
        setRemoteCatalog(true);
        setProductsState(snap);
        return;
      }
      applyLocalCatalogFromStorage();
    };

    const loadRemote = () => {
      hydrateSiteAndUi();

      if (bootstrapFromServer) {
        writeCatalogSnapshot(initialRemoteProducts!);
        clearStaleLocalProductCache();
        setRemoteCatalog(true);
        setProductsState(initialRemoteProducts!);
        setOrders(readJSON<Order[]>(KEY_ORDERS, []));
      } else {
        const snapBootstrap = readCatalogSnapshot();
        if (snapBootstrap && snapBootstrap.length > 0) {
          setProductsState(snapBootstrap);
          setRemoteCatalog(true);
        } else {
          const local = readJSON<Product[]>(KEY_PRODUCTS, []);
          if (local.length > 0) {
            setProductsState(local);
          }
          setRemoteCatalog(false);
        }
        setOrders(readJSON<Order[]>(KEY_ORDERS, []));
      }

      void (async () => {
        const gen = (catalogApplyGenRef.current += 1);
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), STORE_INIT_NETWORK_MS);
        try {
          const storefrontRes = await fetchStorefrontJson(ac.signal);
          if (gen === catalogApplyGenRef.current && storefrontRes.ok) {
            applyStorefront(storefrontRes.site, storefrontRes.collections, storefrontRes.updatedAt);
            if (storefrontRes.source === "r2") setR2Ready(true);
          }

          if (gen !== catalogApplyGenRef.current) return;

          const catalogRes = await fetchCatalogJson(2, ac.signal);
          if (gen !== catalogApplyGenRef.current) return;

          if (catalogRes.ok) {
            writeCatalogSnapshot(catalogRes.products);
            clearStaleLocalProductCache();
            setRemoteCatalog(true);
            setProductsState(catalogRes.products);
            setSupabaseReady(true);
          } else {
            recoverCatalogAfterNetworkFailure();
          }
        } catch {
          /* keep hydrated local/seed UI */
        } finally {
          clearTimeout(timer);
          setStoreReady(true);
        }
      })();
    };

    queueMicrotask(() => loadRemote());
  }, []);

  /** تحديث خفيف عند الرجوع للتطبيق — تسلسلي لتقليل 1102 على Cloudflare. */
  const remoteRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRemoteRefresh = useCallback(() => {
    if (remoteRefreshTimerRef.current) clearTimeout(remoteRefreshTimerRef.current);
    remoteRefreshTimerRef.current = setTimeout(() => {
      void (async () => {
        await refreshCatalog();
        await refreshStorefront();
      })();
    }, 1200);
  }, [refreshCatalog, refreshStorefront]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") scheduleRemoteRefresh();
    };
    const onOnline = () => scheduleRemoteRefresh();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
      catalogRefreshAbortRef.current?.abort();
      if (remoteRefreshTimerRef.current) clearTimeout(remoteRefreshTimerRef.current);
    };
  }, [scheduleRemoteRefresh]);

  const setProducts = useCallback(
    (p: Product[]) => {
      setProductsState(p);
      if (!remoteCatalog) writeJSON(KEY_PRODUCTS, p);
    },
    [remoteCatalog],
  );

  const setCollections = useCallback((c: Collection[]) => {
    setCollectionsState(c);
    writeJSON(KEY_COLLECTIONS, c);
  }, []);
  const setJournal = useCallback((j: JournalArticle[]) => {
    setJournalState(j);
    writeJSON(KEY_JOURNAL, j);
  }, []);
  const setBoutiques = useCallback((b: Boutique[]) => {
    setBoutiquesState(b);
    writeJSON(KEY_BOUTIQUES, b);
  }, []);
  const setSite = useCallback(
    (s: SiteContent) => {
      applySite(s);
    },
    [applySite],
  );

  const saveSite = useCallback(
    async (s: SiteContent): Promise<{ ok: true } | { ok: false; error: string }> => {
      const sanitized = sanitizeSiteContentForServer(s);
      if (!sanitized.ok) return { ok: false, error: "embedded_media" };
      const result = await putStorefrontJson({ site: sanitized.site, collections });
      if (result.ok) {
        applyStorefront(sanitized.site, collections, result.updatedAt);
        setR2Ready(true);
        return { ok: true };
      }
      return { ok: false, error: result.error };
    },
    [applyStorefront, collections],
  );

  const saveCollections = useCallback(
    async (c: Collection[]): Promise<{ ok: true } | { ok: false; error: string }> => {
      const result = await putStorefrontJson({ collections: c, site });
      if (result.ok) {
        applyStorefront(site, c, result.updatedAt);
        setR2Ready(true);
        return { ok: true };
      }
      return { ok: false, error: result.error };
    },
    [applyStorefront, site],
  );

  const resetCatalog = useCallback(() => {
    setProducts(SEED_PRODUCTS);
    setCollections(SEED_COLLECTIONS);
    setJournal(SEED_JOURNAL);
    setBoutiques(SEED_BOUTIQUES);
    setSite(normalizeSiteContent(SEED_SITE));
  }, [setProducts, setCollections, setJournal, setBoutiques, setSite]);

  const addToBag = useCallback(
    ({ productId, size, qty = 1 }: { productId: string; size?: string; qty?: number }) => {
      setBag((curr) => {
        const idx = curr.findIndex(
          (i) => i.productId === productId && (i.size ?? "") === (size ?? ""),
        );
        let next: BagItem[];
        if (idx >= 0) {
          next = curr.slice();
          next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        } else {
          next = [...curr, { productId, size, qty }];
        }
        writeJSON(KEY_BAG, next);
        return next;
      });
    },
    [],
  );

  const removeFromBag = useCallback((productId: string, size?: string) => {
    setBag((curr) => {
      const next = curr.filter(
        (i) => !(i.productId === productId && (i.size ?? "") === (size ?? "")),
      );
      writeJSON(KEY_BAG, next);
      return next;
    });
  }, []);

  const setBagQty = useCallback((productId: string, qty: number, size?: string) => {
    setBag((curr) => {
      const next = curr
        .map((i) =>
          i.productId === productId && (i.size ?? "") === (size ?? "")
            ? { ...i, qty: Math.max(1, qty) }
            : i,
        )
        .filter((i) => i.qty > 0);
      writeJSON(KEY_BAG, next);
      return next;
    });
  }, []);

  const clearBag = useCallback(() => {
    setBag([]);
    writeJSON(KEY_BAG, []);
  }, []);

  const bagCount = useMemo(() => bag.reduce((sum, i) => sum + i.qty, 0), [bag]);

  const toggleWish = useCallback((productId: string) => {
    setWishlist((curr) => {
      const next = curr.includes(productId)
        ? curr.filter((id) => id !== productId)
        : [...curr, productId];
      writeJSON(KEY_WISH, next);
      return next;
    });
  }, []);

  const inWishlist = useCallback(
    (productId: string) => wishlist.includes(productId),
    [wishlist],
  );

  const buildOrderId = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 6; i += 1) {
      s += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return `MUHRA-${s}`;
  };

  const buildOrderItems = useCallback(() => {
    const lookup = new Map(products.map((p) => [p.id, p]));
    const items = bag
      .map((b) => {
        const p = lookup.get(b.productId);
        if (!p) return null;
        return {
          productId: p.id,
          name: p.name,
          price: p.price,
          qty: b.qty,
          size: b.size,
          currency: p.currency,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return items;
  }, [bag, products]);

  const placeDemoOrder = useCallback((): Order | null => {
    if (supabaseReady) return null;
    if (bag.length === 0) return null;
    const items = buildOrderItems();
    if (items.length === 0) return null;
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const currency: Currency = items[0].currency;
    const subtotalIqd = toIqd(subtotal, currency);
    const order: Order = {
      id: buildOrderId(),
      createdAt: new Date().toISOString(),
      customerName: user?.name ?? "Guest",
      items: items.map(({ currency: _c, ...rest }) => {
        void _c;
        return rest;
      }),
      subtotal,
      subtotalIqd,
      shippingFeeIqd: SHIPPING_FEE_IQD,
      totalIqd: subtotalIqd + SHIPPING_FEE_IQD,
      currency,
      status: "pending",
    };
    setOrders((curr) => {
      const next = [order, ...curr];
      writeJSON(KEY_ORDERS, next);
      return next;
    });
    setBag([]);
    writeJSON(KEY_BAG, []);
    return order;
  }, [supabaseReady, bag, buildOrderItems, user]);

  const placeOrder = useCallback(
    async (
      input: PlaceOrderInput,
    ): Promise<{ ok: true; order: Order } | { ok: false; error: string }> => {
      if (bag.length === 0) return { ok: false, error: "empty" };
      const lines = bag.map((b) => ({ productId: b.productId, qty: b.qty, size: b.size }));

      if (supabaseReady) {
        try {
          const { createOrderRemote } = await import("@/app/actions/muhra-backend");
          const res = await createOrderRemote(input, lines);
          if (!res.ok) return { ok: false, error: res.error };
          setBag([]);
          writeJSON(KEY_BAG, []);
          return { ok: true, order: res.order };
        } catch {
          return { ok: false, error: "network" };
        }
      }

      const items = buildOrderItems();
      if (items.length === 0) return { ok: false, error: "empty" };
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
      const currency: Currency = items[0].currency;
      const subtotalIqd = toIqd(subtotal, currency);
      const order: Order = {
        id: buildOrderId(),
        createdAt: new Date().toISOString(),
        customerName: input.customer.name,
        customer: input.customer,
        items: items.map(({ currency: _c, ...rest }) => {
          void _c;
          return rest;
        }),
        subtotal,
        subtotalIqd,
        shippingFeeIqd: SHIPPING_FEE_IQD,
        totalIqd: subtotalIqd + SHIPPING_FEE_IQD,
        currency,
        status: "pending",
        payment: input.payment,
      };
      setOrders((curr) => {
        const next = [order, ...curr];
        writeJSON(KEY_ORDERS, next);
        return next;
      });
      setBag([]);
      writeJSON(KEY_BAG, []);
      return { ok: true, order };
    },
    [supabaseReady, bag, buildOrderItems],
  );

  const setOrderStatus = useCallback(
    async (id: string, status: OrderStatus) => {
      if (supabaseReady) {
        const { updateOrderStatusRemote } = await import("@/app/actions/muhra-backend");
        const ok = await updateOrderStatusRemote(id, status);
        if (ok) void pullRemoteOrders();
        return;
      }
      setOrders((curr) => {
        const next = curr.map((o) => (o.id === id ? { ...o, status } : o));
        writeJSON(KEY_ORDERS, next);
        return next;
      });
    },
    [supabaseReady, pullRemoteOrders],
  );

  const removeOrder = useCallback(
    async (id: string) => {
      if (supabaseReady) {
        const { deleteOrderRemote } = await import("@/app/actions/muhra-backend");
        const ok = await deleteOrderRemote(id);
        if (ok) void pullRemoteOrders();
        return;
      }
      setOrders((curr) => {
        const next = curr.filter((o) => o.id !== id);
        writeJSON(KEY_ORDERS, next);
        return next;
      });
    },
    [supabaseReady, pullRemoteOrders],
  );

  const signIn = useCallback((name: string, email?: string) => {
    const profile: UserProfile = {
      name: name.trim() || "Guest",
      email: email?.trim() || undefined,
      signedInAt: new Date().toISOString(),
    };
    setUser(profile);
    writeJSON(KEY_USER, profile);
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    writeJSON(KEY_USER, null);
  }, []);

  const value = useMemo<StoreCtx>(
    () => ({
      products,
      collections,
      journal,
      boutiques,
      site,
      setProducts,
      setCollections,
      setJournal,
      setBoutiques,
      setSite,
      saveSite,
      saveCollections,
      refreshStorefront,
      resetCatalog,
      bag,
      addToBag,
      removeFromBag,
      setBagQty,
      clearBag,
      bagCount,
      wishlist,
      toggleWish,
      inWishlist,
      remoteCatalog,
      supabaseReady,
      r2Ready,
      refreshCatalog,
      mergeRemoteProduct,
      pullRemoteOrders,
      orders,
      placeDemoOrder,
      placeOrder,
      setOrderStatus,
      removeOrder,
      user,
      signIn,
      signOut,
      hydrated,
      storeReady,
    }),
    [
      products,
      collections,
      journal,
      boutiques,
      site,
      setProducts,
      setCollections,
      setJournal,
      setBoutiques,
      setSite,
      saveSite,
      saveCollections,
      refreshStorefront,
      resetCatalog,
      bag,
      addToBag,
      removeFromBag,
      setBagQty,
      clearBag,
      bagCount,
      wishlist,
      toggleWish,
      inWishlist,
      remoteCatalog,
      supabaseReady,
      r2Ready,
      refreshCatalog,
      mergeRemoteProduct,
      pullRemoteOrders,
      orders,
      placeDemoOrder,
      placeOrder,
      setOrderStatus,
      removeOrder,
      user,
      signIn,
      signOut,
      hydrated,
      storeReady,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
