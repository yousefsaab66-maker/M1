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

/** لا نُبقي واجهة المستخدم معلّقة بانتظار Workers بطيئة أو معلّقة (أوّل تحميل قد يكون بارد على CF). */
const STORE_INIT_NETWORK_MS = 45_000;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  /** يُحدَّد وقت التشغيل من `/api/catalog/products` حتى يعمل الكتالوج لو غاب NEXT_PUBLIC وقت بناء الاستضافة. */
  const [remoteCatalog, setRemoteCatalog] = useState(false);
  const [supabaseReady, setSupabaseReady] = useState(false);
  const [r2Ready, setR2Ready] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [products, setProductsState] = useState<Product[]>(SEED_PRODUCTS);
  const [collections, setCollectionsState] = useState<Collection[]>(SEED_COLLECTIONS);
  const [journal, setJournalState] = useState<JournalArticle[]>(SEED_JOURNAL);
  const [boutiques, setBoutiquesState] = useState<Boutique[]>(SEED_BOUTIQUES);
  const [site, setSiteState] = useState<SiteContent>(SEED_SITE);

  const [bag, setBag] = useState<BagItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);

  const initialized = useRef(false);
  /** Supersedes in-flight catalog GETs so an older request cannot overwrite a newer one (init vs staff save, double refresh). */
  const catalogApplyGenRef = useRef(0);

  const refreshCatalog = useCallback(async () => {
    const gen = (catalogApplyGenRef.current += 1);
    const res = await fetchCatalogJson(2);
    if (gen !== catalogApplyGenRef.current) return;
    if (!res.ok) return;
    writeCatalogSnapshot(res.products);
    clearStaleLocalProductCache();
    setRemoteCatalog(true);
    setProductsState(res.products);
  }, []);

  const mergeRemoteProduct = useCallback((p: Product) => {
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
      setCollectionsState(readJSON<Collection[]>(KEY_COLLECTIONS, SEED_COLLECTIONS));
      setJournalState(readJSON<JournalArticle[]>(KEY_JOURNAL, SEED_JOURNAL));
      setBoutiquesState(readJSON<Boutique[]>(KEY_BOUTIQUES, SEED_BOUTIQUES));
      setSiteState(readJSON<SiteContent>(KEY_SITE, SEED_SITE));
      setBag(readJSON<BagItem[]>(KEY_BAG, []));
      setWishlist(readJSON<string[]>(KEY_WISH, []));
      setUser(readJSON<UserProfile | null>(KEY_USER, null));
      setHydrated(true);
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

    queueMicrotask(() => {
      /* لو انتظرنا الشبكة قبل hydrate، صفحات مثل السلة أو الـ staff تبدو «متوقفة» إذا علّق /api على Cloudflare. */
      hydrateSiteAndUi();
      const snapBootstrap = readCatalogSnapshot();
      if (snapBootstrap && snapBootstrap.length > 0) {
        setProductsState(snapBootstrap);
        setRemoteCatalog(true);
      } else {
        setProductsState(readJSON<Product[]>(KEY_PRODUCTS, SEED_PRODUCTS));
        setRemoteCatalog(false);
      }
      setOrders(readJSON<Order[]>(KEY_ORDERS, []));

      void (async () => {
        const gen = (catalogApplyGenRef.current += 1);
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), STORE_INIT_NETWORK_MS);
        try {
          const [healthOutcome, r2Outcome, catalogRes] = await Promise.all([
            fetch("/api/health/supabase", { ...CATALOG_FETCH_OPTS, signal: ac.signal })
              .then((r) => (r.ok ? (r.json() as Promise<{ ready?: unknown }>) : Promise.resolve({})))
              .catch(() => ({})),

            fetch("/api/health/r2", { ...CATALOG_FETCH_OPTS, signal: ac.signal })
              .then((r) => (r.ok ? (r.json() as Promise<{ ready?: unknown }>) : Promise.resolve({})))
              .catch(() => ({})),

            fetchCatalogJson(3, ac.signal),
          ]);

          setSupabaseReady((healthOutcome as { ready?: boolean }).ready === true);
          setR2Ready((r2Outcome as { ready?: boolean }).ready === true);

          if (gen !== catalogApplyGenRef.current) return;

          if (catalogRes.ok) {
            writeCatalogSnapshot(catalogRes.products);
            clearStaleLocalProductCache();
            setRemoteCatalog(true);
            setProductsState(catalogRes.products);
          } else {
            recoverCatalogAfterNetworkFailure();
          }
        } finally {
          clearTimeout(timer);
        }
      })();
    });
  }, []);

  /** الجوال يبقى التطبيق بالخلفية؛ عند الرجوع نحدّث الكتالوج حتى يظهر آخر منتج من Supabase. */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshCatalog();
    };
    const onOnline = () => void refreshCatalog();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
    };
  }, [refreshCatalog]);

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
  const setSite = useCallback((s: SiteContent) => {
    setSiteState(s);
    writeJSON(KEY_SITE, s);
  }, []);

  const resetCatalog = useCallback(() => {
    setProducts(SEED_PRODUCTS);
    setCollections(SEED_COLLECTIONS);
    setJournal(SEED_JOURNAL);
    setBoutiques(SEED_BOUTIQUES);
    setSite(SEED_SITE);
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
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
