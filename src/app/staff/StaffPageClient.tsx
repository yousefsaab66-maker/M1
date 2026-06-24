"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Gem,
  Images,
  KeyRound,
  LayoutDashboard,
  Newspaper,
  Pencil,
  Plus,
  MapPin,
  RotateCcw,
  Settings,
  ShoppingBag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { SectionTitle } from "@/components/Section";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useStore, type OrderStatus } from "@/components/providers/StoreProvider";
import type {
  Boutique,
  Category,
  Collection,
  Currency,
  JournalArticle,
  Material,
  Product,
  SiteContent,
  Stone,
} from "@/lib/catalog";
import { formatDate, formatPrice, slugify } from "@/lib/format";
import { formatIqd, iqdToUsd, isIraqCountry, orderRevenueIqd } from "@/lib/iraq";
import {
  ensureProductOrderable,
  MUHRA_PLACEHOLDER_IMAGE,
  productGallerySources,
  productHasEmbeddedImages,
  productImageAt,
} from "@/lib/product-media";
import {
  emptyPriceOptions,
  getActivePriceSlots,
  getProductListingPrice,
  isProductInStock,
  isStockTracked,
  priceSlotLabel,
  PRICE_SLOT_COUNT,
  type ProductPriceOptions,
  type ProductPriceSlot,
} from "@/lib/product-prices";
import {
  enabledEmptySizeKinds,
  formatSizeOptionsSummary,
  formatOrderSizeDisplay,
  getProductSizeGroups,
  isSizeKindEnabled,
  productSizeKindForCategory,
  SIZE_PRESETS,
  sizeKindLabelKey,
  type ProductSizeKind,
  type ProductSizeOptions,
} from "@/lib/product-sizes";
import { afterStaffCatalogMutation, hintPurgeCatalogCache, purgeCatalogCacheNow } from "@/lib/storefront-client";
import { isDatabaseProductId } from "@/lib/catalog-db";
import { normalizeStaffMediaUrl } from "@/lib/staff-media-url";
import { isAllowedStaffVideoMime, staffVideoMimeFromFile } from "@/lib/supabase/storage-constants";
import {
  translateStaffUploadError,
  uploadStaffImageFile,
  uploadStaffMediaFile,
} from "@/lib/staff-upload-client";
import {
  StaffAllImagesEditor,
  StaffBoutiquesEditor,
  StaffCategoriesEditor,
  StaffCommerceSettingsEditor,
  StaffCustomCategoriesEditor,
  StaffHomepageEditor,
  StaffSiteTextsEditor,
  StaffSingleImageField,
} from "@/components/staff/StaffSiteEditor";
import type { Order } from "@/lib/commerce-types";
import { normalizeSiteContent, getUsdIqdRate, hasConfiguredUsdIqdRate, catalogFilterSlugs, productCategoryLabel } from "@/lib/site-display";
import { isCoarsePointerDevice, yieldToMain } from "@/lib/touch-device";
import { useBodyScrollLock } from "@/components/staff/useBodyScrollLock";

const STAFF_PRODUCTS_PAGE_SIZE_DEFAULT = 60;
const STAFF_PRODUCTS_PAGE_SIZE_TOUCH = 30;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Read error"));
    reader.readAsDataURL(file);
  });
}

type TabId =
  | "dashboard"
  | "products"
  | "orders"
  | "collections"
  | "journal"
  | "boutiques"
  | "site"
  | "security";

export default function StaffPageClient() {
  const { signedInAs, signOut, hydrated } = useAuth();
  const { supabaseReady, pullRemoteOrders, refreshStaffStorefrontExtras, staffCloudUpload, r2PresignConfigured } =
    useStore();
  const { t } = useLocale();
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("dashboard");
  const [productsCategoryFilter, setProductsCategoryFilter] = useState<string | null>(null);

  const tabs = useMemo(
    () =>
      [
        { id: "dashboard" as const, label: t("staff.nav.dashboard"), icon: LayoutDashboard },
        { id: "products" as const, label: t("staff.nav.products"), icon: Gem },
        { id: "orders" as const, label: t("staff.nav.orders"), icon: ClipboardList },
        { id: "collections" as const, label: t("staff.nav.collections"), icon: ArchiveRestore },
        { id: "journal" as const, label: t("staff.nav.journal"), icon: Newspaper },
        { id: "boutiques" as const, label: t("staff.nav.boutiques"), icon: MapPin },
        { id: "site" as const, label: t("staff.nav.site"), icon: Settings },
        { id: "security" as const, label: t("staff.nav.security"), icon: KeyRound },
      ] satisfies { id: TabId; label: string; icon: typeof LayoutDashboard }[],
    [t],
  );

  useEffect(() => {
    if (hydrated && !signedInAs.staff) router.replace("/staff/login");
  }, [hydrated, signedInAs.staff, router]);

  useEffect(() => {
    if (hydrated && signedInAs.staff && supabaseReady) void pullRemoteOrders();
  }, [hydrated, signedInAs.staff, supabaseReady, pullRemoteOrders]);

  useEffect(() => {
    if (!hydrated || !signedInAs.staff) return;
    if (tab === "journal" || tab === "boutiques" || tab === "site" || tab === "collections") {
      void refreshStaffStorefrontExtras();
    }
  }, [hydrated, signedInAs.staff, tab, refreshStaffStorefrontExtras]);

  if (!hydrated) return <div className="px-6 py-32 text-center opacity-70">…</div>;
  if (!signedInAs.staff) return null;

  return (
    <div className="min-w-0 overflow-x-hidden px-4 py-8 sm:px-5 sm:py-12 md:px-10 md:py-12 [padding-bottom:max(2rem,env(safe-area-inset-bottom,0px))]">
      <div className="mx-auto min-w-0 max-w-[1500px]">
        <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow break-words text-[10px] sm:text-[11px]">MUHRA · {t("staff.shell.eyebrow")} · {signedInAs.staff}</p>
            <h1 className="font-display mt-2 break-words text-2xl sm:mt-3 sm:text-4xl md:text-5xl">{t("staff.shell.title")}</h1>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2 sm:gap-3">
            <Link href={"/" as never} className="text-[10px] tracking-eyebrow uppercase gold-underline sm:text-[11px]">
              {t("staff.shell.viewStore")}
            </Link>
            <button type="button" onClick={() => signOut("staff")} className="btn-ghost">
              {t("common.signout")}
            </button>
          </div>
        </header>

        {staffCloudUpload && r2PresignConfigured === false ? (
          <p
            role="status"
            className="mt-4 rounded border border-amber-600/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-900 dark:text-amber-200"
          >
            {t("staff.images.presignWarning")}
          </p>
        ) : null}

        <div className="mt-6 grid min-w-0 gap-6 sm:mt-8 sm:gap-8 lg:mt-10 lg:grid-cols-[minmax(0,220px)_1fr] lg:gap-12">
          <nav className="lg:sticky lg:top-28 lg:self-start">
            <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [-webkit-overflow-scrolling:touch] sm:mx-0 sm:px-0 lg:flex-col lg:gap-1">
              {tabs.map((tabDef) => (
                <li key={tabDef.id}>
                  <button
                    type="button"
                    onClick={() => setTab(tabDef.id)}
                    aria-pressed={tab === tabDef.id}
                    className="staff-tab staff-touch-target"
                    data-active={tab === tabDef.id}
                  >
                    <tabDef.icon className="h-4 w-4" strokeWidth={1.4} />
                    <span>{tabDef.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="min-w-0">
            {tab === "dashboard" && <DashboardPane />}
            {tab === "products" && (
              <ProductsPane
                categoryFilter={productsCategoryFilter}
                onCategoryFilterChange={setProductsCategoryFilter}
              />
            )}
            {tab === "orders" && <OrdersPane />}
            {tab === "collections" && <CollectionsPane />}
            {tab === "journal" && <JournalPane />}
            {tab === "boutiques" && <BoutiquesPane />}
            {tab === "site" && (
              <SitePane
                onViewProducts={(slug) => {
                  setProductsCategoryFilter(slug);
                  setTab("products");
                }}
              />
            )}
            {tab === "security" && <SecurityPane />}
          </div>
        </div>
      </div>
      <style jsx global>{`
        .staff-tab {
          display: inline-flex;
          align-items: center;
          gap: 0.7rem;
          padding: 0.7rem 1rem;
          min-height: 2.75rem;
          font-size: 0.7rem;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          border: 1px solid var(--line);
          background: transparent;
          white-space: nowrap;
          transition: background 0.35s var(--ease-luxe), color 0.35s var(--ease-luxe), border-color 0.35s var(--ease-luxe);
        }
        @media (max-width: 639px) {
          .staff-tab { min-height: 3rem; padding: 0.65rem 0.85rem; }
          .staff-table th, .staff-table td { padding: 0.5rem 0.45rem; font-size: 0.78rem; }
          .staff-card { padding: 1rem; }
        }
        .staff-table-wrap { -webkit-overflow-scrolling: touch; }
        .staff-tab:hover { border-color: var(--color-gold); }
        .staff-tab[data-active="true"] {
          background: var(--color-onyx);
          color: var(--color-ivory);
          border-color: var(--color-onyx);
        }
        .chip {
          display: inline-flex;
          align-items: center;
          padding: 0.35rem 0.75rem;
          font-size: 0.62rem;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          border: 1px solid var(--line-strong);
          background: transparent;
        }
        .chip-active {
          background: var(--color-onyx);
          color: var(--color-ivory);
          border-color: var(--color-onyx);
        }
        [data-theme="dark"] .chip-active {
          background: var(--color-ivory);
          color: var(--color-onyx);
          border-color: var(--color-ivory);
        }
        [data-theme="dark"] .staff-tab[data-active="true"] {
          background: var(--color-ivory);
          color: var(--color-onyx);
          border-color: var(--color-ivory);
        }
        .staff-card { background: var(--surface); border: 1px solid var(--line); padding: 1.5rem; }
        .staff-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .staff-table th, .staff-table td { text-align: start; padding: 0.85rem 0.75rem; border-bottom: 1px solid var(--line); }
        .staff-table th { font-size: 0.66rem; letter-spacing: 0.32em; text-transform: uppercase; opacity: 0.7; }
        .staff-input { width: 100%; padding: 0.7rem 0.9rem; border: 1px solid var(--line-strong); background: transparent; color: var(--foreground); font-size: 0.85rem; outline: none; transition: border-color 0.3s var(--ease-luxe); }
        .staff-input:focus { border-color: var(--color-gold); }
        .staff-label { display: block; font-size: 0.66rem; letter-spacing: 0.32em; text-transform: uppercase; margin-bottom: 0.4rem; opacity: 0.75; }
        .staff-image-group { border: 1px solid var(--line); padding: 1rem 1.15rem; background: var(--surface); }
        .staff-image-group + .staff-image-group { margin-top: 0; }
        .staff-image-group__summary { display: flex; align-items: center; gap: 0.5rem; }
        .staff-image-group__summary::-webkit-details-marker { display: none; }
        .staff-image-group__summary::after {
          content: "▾";
          margin-inline-start: auto;
          opacity: 0.5;
          font-size: 0.75rem;
        }
        .staff-image-group[open] .staff-image-group__summary::after { transform: rotate(180deg); }
        .staff-image-tile { border-radius: 2px; }
      `}</style>
    </div>
  );
}

function DashboardPane() {
  const { products, orders, collections, journal, site } = useStore();
  const { t, locale } = useLocale();
  const pending = orders.filter((o) => o.status === "pending").length;
  const shipped = orders.filter((o) => o.status === "shipped" || o.status === "delivered").length;
  const usdIqdRate = getUsdIqdRate(site);
  const rateOpts = { usdIqdRate };
  const revenueIqd = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((s, o) => s + orderRevenueIqd(o, rateOpts), 0);
  const revenueUsd = iqdToUsd(revenueIqd, rateOpts);
  const usingDefaultRate = !hasConfiguredUsdIqdRate(site);
  const stats = [
    { label: t("staff.dashboard.statProducts"), value: products.length },
    { label: t("staff.dashboard.statCollections"), value: collections.length },
    { label: t("staff.dashboard.statJournal"), value: journal.length },
    { label: t("staff.dashboard.statOrders"), value: orders.length },
    { label: t("staff.dashboard.statPending"), value: pending },
    { label: t("staff.dashboard.statShipped"), value: shipped },
  ];
  return (
    <section>
      <SectionTitle eyebrow="MUHRA" title={t("staff.dashboard.overviewTitle")} align="center" />
      <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="staff-card text-center">
            <p className="eyebrow">{s.label}</p>
            <p className="font-display mt-3 text-4xl">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 staff-card">
        <p className="eyebrow">{t("staff.dashboard.demoRevenue")}</p>
        <p className="font-display mt-3 text-4xl">{formatPrice(revenueUsd, "USD", locale)}</p>
        {usingDefaultRate && (
          <p className="mt-2 text-xs opacity-65">
            {t("staff.dashboard.revenueRateFallback").replace("{rate}", String(usdIqdRate))}
          </p>
        )}
      </div>
    </section>
  );
}

function emptyProduct(): Product {
  return {
    id: "tmp-" + Math.random().toString(36).slice(2),
    slug: "",
    name: "",
    collection: "muhra-heritage",
    category: "necklaces",
    price: 0,
    currency: "IQD",
    materials: ["gold"],
    stones: ["none"],
    images: [],
    description: "",
    story: "",
    related: [],
  };
}

const persistProductInFlight = new Set<string>();
const deleteProductInFlight = new Set<string>();

function isWorkerBusyHttpStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 524;
}

function persistProductFlightKey(p: Product): string {
  return isDatabaseProductId(p.id) ? p.id : `new:${p.slug.trim() || p.id}`;
}

function mapRemoteProductError(error: string, t: (key: string) => string): string {
  if (error === "__in_flight__") return t("staff.products.errorInFlight");
  if (error === "not_configured") return t("staff.products.errorNotConfigured");
  if (error === "unauthorized") return t("staff.products.errorUnauthorized");
  if (error === "not_found" || error === "invalid_id") return t("staff.products.errorDelete");
  if (error === "missing_id") return t("staff.products.errorMissingId");
  if (error === "invalid_json") return t("staff.products.errorInvalidJson");
  if (error === "payload_image_too_large" || error === "payload_images_too_large")
    return t("staff.products.errorPayloadImages");
  if (error === "worker_busy") return t("staff.products.errorWorkerBusy");
  if (error === "update_failed" || error === "insert_failed") return t("staff.products.errorServer");
  if (/1102|exceeded.*cpu|worker.*timeout/i.test(error)) return t("staff.products.errorWorkerBusy");
  if (error === "unknown") return t("staff.products.errorServer");
  return t("staff.products.errorServer");
}

async function persistProductRemote(
  p: Product,
  t: (key: string) => string,
  mergeRemoteProduct: (product: Product) => void,
  removeRemoteProduct: (id: string) => void,
  previous?: Product,
): Promise<{ ok: true; product: Product } | { ok: false; error: string }> {
  const fixed = ensureProductOrderable(p);
  const flightKey = persistProductFlightKey(fixed);
  if (persistProductInFlight.has(flightKey)) {
    return { ok: false, error: "__in_flight__" };
  }
  persistProductInFlight.add(flightKey);

  const rollback = () => {
    if (previous) mergeRemoteProduct(previous);
    else if (!isDatabaseProductId(fixed.id)) removeRemoteProduct(fixed.id);
  };

  mergeRemoteProduct(fixed);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 120_000);
  try {
    const res = await fetch("/api/staff/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(fixed),
      signal: ac.signal,
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      product?: Product;
      error?: string;
    };
    if (res.status === 401 || body.error === "unauthorized") {
      rollback();
      return { ok: false, error: mapRemoteProductError("unauthorized", t) };
    }
    if (isWorkerBusyHttpStatus(res.status)) {
      rollback();
      return { ok: false, error: mapRemoteProductError("worker_busy", t) };
    }
    if (!body.ok || !body.product) {
      rollback();
      return {
        ok: false,
        error: mapRemoteProductError(typeof body.error === "string" ? body.error : "unknown", t),
      };
    }
    mergeRemoteProduct(body.product);
    afterStaffCatalogMutation();
    hintPurgeCatalogCache();
    return { ok: true, product: body.product };
  } catch (e) {
    rollback();
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, error: t("staff.products.errorTimeout") };
    }
    return { ok: false, error: t("staff.products.errorRequest") };
  } finally {
    clearTimeout(timer);
    persistProductInFlight.delete(flightKey);
  }
}

function ProductsPane({
  categoryFilter,
  onCategoryFilterChange,
}: {
  categoryFilter: string | null;
  onCategoryFilterChange: (slug: string | null) => void;
}) {
  const {
    products,
    collections,
    addToBag,
    remoteCatalog,
    supabaseReady,
    staffCloudUpload,
    refreshCatalog,
    mergeRemoteProduct,
    removeRemoteProduct,
    site,
  } = useStore();
  const { t, locale } = useLocale();
  const mediaCloudUpload = staffCloudUpload;
  const router = useRouter();
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [orderHint, setOrderHint] = useState<Product | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [imageQuickEdit, setImageQuickEdit] = useState<Product | null>(null);
  const [productsPage, setProductsPage] = useState(1);
  const pageSize = useMemo(
    () => (isCoarsePointerDevice() ? STAFF_PRODUCTS_PAGE_SIZE_TOUCH : STAFF_PRODUCTS_PAGE_SIZE_DEFAULT),
    [],
  );
  const embeddedCount = useMemo(
    () => products.filter(productHasEmbeddedImages).length,
    [products],
  );
  const categoryOptions = useMemo(() => catalogFilterSlugs(site), [site]);
  const visibleProducts = useMemo(
    () => (categoryFilter ? products.filter((p) => p.category === categoryFilter) : products),
    [products, categoryFilter],
  );
  const pagedProducts = useMemo(
    () => visibleProducts.slice(0, productsPage * pageSize),
    [visibleProducts, productsPage, pageSize],
  );
  const hasMoreProducts = pagedProducts.length < visibleProducts.length;

  useEffect(() => {
    setProductsPage(1);
  }, [categoryFilter]);

  const persistProduct = async (p: Product): Promise<boolean> => {
    setSaveError(null);
    if (!supabaseReady) {
      setSaveError(t("staff.products.remoteRequired"));
      return false;
    }
    const previous = products.find((x) => x.id === p.id);
    const result = await persistProductRemote(p, t, mergeRemoteProduct, removeRemoteProduct, previous);
    if (!result.ok) {
      if (result.error !== "__in_flight__") setSaveError(result.error);
      return false;
    }
    setOrderHint(result.product);
    return true;
  };

  const onSave = async (p: Product) => {
    if (await persistProduct(p)) {
      setEditing(null);
      setCreating(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!supabaseReady) {
      setSaveError(t("staff.products.remoteRequired"));
      return;
    }
    if (typeof window !== "undefined" && !window.confirm(t("staff.products.deleteConfirm"))) return;
    if (deleteProductInFlight.has(id)) return;
    deleteProductInFlight.add(id);
    setSaveError(null);
    const local = products.find((p) => p.id === id);
    if (!local && isDatabaseProductId(id)) {
      deleteProductInFlight.delete(id);
      setSaveError(t("staff.products.errorNotFound"));
      return;
    }
    const removed = local;
    removeRemoteProduct(id);
    if (editing?.id === id) {
      setEditing(null);
      setCreating(false);
    }
    if (!isDatabaseProductId(id)) {
      afterStaffCatalogMutation();
      deleteProductInFlight.delete(id);
      return;
    }
    try {
      const res = await fetch(`/api/staff/products?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.status === 401 || body.error === "unauthorized") {
        if (removed) mergeRemoteProduct(removed);
        setSaveError(mapRemoteProductError("unauthorized", t));
        return;
      }
      if (isWorkerBusyHttpStatus(res.status)) {
        if (removed) mergeRemoteProduct(removed);
        setSaveError(mapRemoteProductError("worker_busy", t));
        return;
      }
      if (body.error === "not_found") {
        afterStaffCatalogMutation();
        purgeCatalogCacheNow();
        return;
      }
      if (!res.ok || !body.ok) {
        if (removed) mergeRemoteProduct(removed);
        setSaveError(mapRemoteProductError(typeof body.error === "string" ? body.error : "unknown", t));
        return;
      }
      afterStaffCatalogMutation();
      purgeCatalogCacheNow();
    } catch {
      if (removed) mergeRemoteProduct(removed);
      setSaveError(t("staff.products.errorDelete"));
    } finally {
      deleteProductInFlight.delete(id);
    }
  };

  return (
    <section>
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="font-display min-w-0 break-words text-2xl sm:text-3xl">
            {t("staff.products.count").replace("{n}", String(products.length))}
          </h2>
          {!supabaseReady && (
            <p
              className="mt-3 max-w-2xl text-[12px] leading-relaxed text-amber-900 dark:text-amber-200/95 sm:text-[13px]"
              role="status"
            >
              {t("staff.products.supabaseShort")}
            </p>
          )}
        </div>
        <button
          type="button"
          title={!supabaseReady ? t("staff.products.remoteRequired") : undefined}
          onClick={() => {
            if (!supabaseReady) {
              setSaveError(t("staff.products.supabaseShort"));
              return;
            }
            setSaveError(null);
            setEditing(emptyProduct());
            setCreating(true);
          }}
          className={
            supabaseReady
              ? "btn-primary shrink-0 self-start"
              : "shrink-0 self-start border-2 border-amber-600/55 bg-amber-500/15 px-4 py-2.5 text-[11px] font-medium uppercase tracking-eyebrow text-amber-950 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-50"
          }
        >
          <Plus className="h-4 w-4" strokeWidth={1.4} /> {t("staff.products.new")}
        </button>
      </header>

      {saveError && (
        <p className="mt-4 text-sm" style={{ color: "var(--color-bordeaux)" }} role="alert">
          {saveError}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <p className="eyebrow me-1">{t("staff.products.filterCategory")}</p>
        <button
          type="button"
          className={`chip ${categoryFilter === null ? "chip-active" : ""}`}
          onClick={() => onCategoryFilterChange(null)}
        >
          {t("staff.products.filterAll")}
        </button>
        {categoryOptions.map((c) => (
          <button
            key={c}
            type="button"
            className={`chip ${categoryFilter === c ? "chip-active" : ""}`}
            onClick={() => onCategoryFilterChange(c)}
          >
            {productCategoryLabel(c, site, t, locale)}
          </button>
        ))}
        {categoryFilter && (
          <button
            type="button"
            className="text-[10px] uppercase tracking-eyebrow opacity-60 hover:opacity-100"
            onClick={() => onCategoryFilterChange(null)}
          >
            {t("staff.products.filterClear")}
          </button>
        )}
      </div>

      {embeddedCount > 0 && (
        <div
          className="mt-4 staff-card border border-amber-600/40 bg-amber-500/10 text-start"
          role="status"
        >
          <p className="text-[11px] font-medium uppercase tracking-eyebrow text-amber-900 dark:text-amber-200/95">
            {t("staff.products.embeddedBannerTitle").replace("{n}", String(embeddedCount))}
          </p>
          <p className="mt-2 text-sm leading-relaxed opacity-90 text-amber-950 dark:text-amber-50/90">
            {t("staff.products.embeddedBannerBody")}
          </p>
        </div>
      )}

      {!remoteCatalog && (
        <div
          className="mt-6 staff-card border border-amber-600/40 bg-amber-500/10 text-start"
          role="status"
        >
          <p className="text-[11px] font-medium uppercase tracking-eyebrow text-amber-900 dark:text-amber-200/95">
            {t("staff.catalog.localOnlyTitle")}
          </p>
          <p className="mt-3 text-sm leading-relaxed opacity-90 text-amber-950 dark:text-amber-50/90">
            {t("staff.catalog.localOnlyBody")}
          </p>
          <button
            type="button"
            className="btn-ghost mt-4 inline-flex items-center gap-2 text-[11px] tracking-eyebrow uppercase"
            onClick={() => void refreshCatalog()}
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.4} /> {t("staff.catalog.retryRemote")}
          </button>
        </div>
      )}

      {orderHint && (
        <div
          className="mt-6 flex flex-col gap-4 staff-card md:flex-row md:items-center md:justify-between"
          role="status"
        >
          <p className="max-w-xl text-sm leading-relaxed opacity-90">{t("staff.product.savedBanner")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/products/${orderHint.slug}` as never}
              className="btn-ghost inline-flex items-center gap-2 text-[11px] tracking-eyebrow uppercase"
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.4} />
              {t("staff.product.viewPage")}
            </Link>
            <button
              type="button"
              className="btn-ghost inline-flex items-center gap-2 text-[11px] tracking-eyebrow uppercase"
              onClick={() => {
                addToBag({ productId: orderHint.id, qty: 1 });
                router.push("/bag" as never);
              }}
            >
              <ShoppingBag className="h-3.5 w-3.5" strokeWidth={1.4} />
              {t("staff.product.addToBag")}
            </button>
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-2 text-[11px] tracking-eyebrow uppercase"
              onClick={() => {
                addToBag({ productId: orderHint.id, qty: 1 });
                router.push("/checkout" as never);
              }}
            >
              {t("staff.product.goCheckout")}
            </button>
            <button
              type="button"
              className="ms-1 text-[11px] uppercase tracking-eyebrow opacity-60 hover:opacity-100"
              onClick={() => setOrderHint(null)}
            >
              {t("staff.product.dismiss")}
            </button>
          </div>
        </div>
      )}
      <div className="staff-table-wrap mt-6 overflow-x-auto staff-card p-0">
        <table className="staff-table min-w-[640px]">
          <thead>
            <tr>
              <th className="w-16">{t("staff.table.photo")}</th>
              <th>{t("staff.table.name")}</th>
              <th>{t("staff.table.collection")}</th>
              <th>{t("staff.table.category")}</th>
              <th>{t("staff.table.sizes")}</th>
              <th>{t("staff.table.stock")}</th>
              <th>{t("staff.table.price")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pagedProducts.map((p) => (
              <StaffProductRow
                key={p.id}
                product={p}
                site={site}
                supabaseReady={supabaseReady}
                onQuickOrder={() => {
                  addToBag({ productId: p.id, qty: 1 });
                  router.push("/checkout" as never);
                }}
                onEditImages={() => setImageQuickEdit(p)}
                onEdit={() => {
                  setEditing(p);
                  setCreating(false);
                }}
                onDelete={() => void onDelete(p.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {hasMoreProducts && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            className="btn-ghost staff-touch-target"
            onClick={() => setProductsPage((n) => n + 1)}
          >
            {t("staff.products.loadMore").replace("{n}", String(visibleProducts.length - pagedProducts.length))}
          </button>
        </div>
      )}

      {(editing || imageQuickEdit) && (
        <p className="sr-only" aria-live="polite">
          {editing ? t("staff.form.editTitle") : t("staff.product.imagesModalEyebrow")}
        </p>
      )}

      {imageQuickEdit && (
        <ProductImagesQuickModal
          key={imageQuickEdit.id}
          product={imageQuickEdit}
          cloudUpload={mediaCloudUpload}
          onClose={() => setImageQuickEdit(null)}
          onSave={async (p) => {
            if (await persistProduct(p)) setImageQuickEdit(null);
          }}
        />
      )}

      {editing && (
        <ProductEditor
          key={editing.id}
          product={editing}
          collections={collections}
          isCreating={creating}
          cloudUpload={mediaCloudUpload}
          onCancel={() => { setEditing(null); setCreating(false); }}
          onSave={onSave}
        />
      )}
    </section>
  );
}

const StaffProductRow = memo(function StaffProductRow({
  product: p,
  site,
  supabaseReady,
  onQuickOrder,
  onEditImages,
  onEdit,
  onDelete,
}: {
  product: Product;
  site: SiteContent;
  supabaseReady: boolean;
  onQuickOrder: () => void;
  onEditImages: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t, locale } = useLocale();
  return (
    <tr>
      <td>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={productImageAt(p, 0)}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-12 w-12 shrink-0 border object-cover"
          style={{ borderColor: "var(--line)" }}
        />
      </td>
      <td className="font-display text-base">
        {p.name}
        {productHasEmbeddedImages(p) && (
          <span
            className="ms-2 inline-block text-[10px] uppercase tracking-eyebrow text-amber-800 dark:text-amber-200/90"
            title={t("staff.products.embeddedRowHint")}
          >
            {t("staff.products.embeddedBadge")}
          </span>
        )}
      </td>
      <td className="opacity-80">{p.collection}</td>
      <td className="opacity-80">{productCategoryLabel(p.category, site, t, locale)}</td>
      <td className="max-w-[140px] text-sm opacity-90">
        {formatSizeOptionsSummary(p.sizeOptions) || (p.sizes?.length ? p.sizes.join(", ") : "—")}
      </td>
      <td className="text-sm opacity-90">
        {!isStockTracked(p)
          ? "—"
          : isProductInStock(p)
            ? p.stock != null && p.stock > 0
              ? String(p.stock)
              : t("product.inStock")
            : t("product.outOfStock")}
      </td>
      <td>{formatPrice(getProductListingPrice(p), p.currency, "en")}</td>
      <td>
        <div className="flex justify-end gap-2">
          <Link
            href={`/products/${p.slug}` as never}
            target="_blank"
            rel="noreferrer"
            className="staff-touch-target flex h-9 w-9 items-center justify-center opacity-70 hover:opacity-100"
            aria-label={t("staff.product.viewPage")}
            title={t("staff.product.viewPage")}
          >
            <ExternalLink className="h-4 w-4" strokeWidth={1.4} />
          </Link>
          <button
            type="button"
            className="staff-touch-target flex h-9 w-9 items-center justify-center opacity-70 hover:opacity-100"
            aria-label={t("staff.product.quickOrder")}
            title={t("staff.product.quickOrder")}
            onClick={onQuickOrder}
          >
            <ShoppingBag className="h-4 w-4" strokeWidth={1.4} />
          </button>
          <button
            type="button"
            disabled={!supabaseReady}
            aria-label={t("staff.product.editImages")}
            title={t("staff.product.editImages")}
            onClick={onEditImages}
            className="staff-touch-target opacity-70 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Images className="h-4 w-4" strokeWidth={1.4} />
          </button>
          <button
            type="button"
            disabled={!supabaseReady}
            aria-label={t("staff.aria.edit")}
            title={!supabaseReady ? t("staff.products.remoteRequired") : undefined}
            onClick={onEdit}
            className="staff-touch-target opacity-70 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Pencil className="h-4 w-4" strokeWidth={1.4} />
          </button>
          <button
            type="button"
            disabled={!supabaseReady}
            aria-label={t("staff.aria.delete")}
            title={!supabaseReady ? t("staff.products.remoteRequired") : undefined}
            onClick={onDelete}
            className="staff-touch-target opacity-70 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.4} />
          </button>
        </div>
      </td>
    </tr>
  );
});

function ProductImagesQuickModal({
  product,
  cloudUpload,
  onClose,
  onSave,
}: {
  product: Product;
  cloudUpload: boolean;
  onClose: () => void;
  onSave: (p: Product) => void | Promise<void>;
}) {
  const { t } = useLocale();
  const [draft, setDraft] = useState<Product>(() => ({ ...product }));
  const [busy, setBusy] = useState(false);
  useBodyScrollLock(true);

  return (
    <div className="staff-modal-root z-[60] flex items-end justify-center sm:items-center sm:px-4">
      <div
        className="staff-modal-backdrop bg-black/55"
        onClick={() => !busy && onClose()}
        onTouchEnd={(e) => {
          if (busy) return;
          if (e.target === e.currentTarget) onClose();
        }}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-images-quick-title"
        className="staff-modal-panel flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-none border shadow-2xl sm:rounded-sm"
        style={{ background: "var(--background)", borderColor: "var(--line)" }}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b p-4 sm:p-5" style={{ borderColor: "var(--line)" }}>
          <div className="min-w-0">
            <p className="eyebrow opacity-75">{t("staff.product.imagesModalEyebrow")}</p>
            <h3 id="staff-images-quick-title" className="font-display mt-1 break-words text-xl sm:text-2xl">
              {draft.name || product.name}
            </h3>
          </div>
          <button type="button" disabled={busy} onClick={onClose} className="staff-touch-target flex h-11 w-11 flex-shrink-0 items-center justify-center" aria-label={t("staff.aria.close")}>
            <X className="h-5 w-5" strokeWidth={1.4} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:p-6">
          <ImagesField
            cloudUpload={cloudUpload}
            images={[...(draft.images ?? [])]}
            onChange={(next) => setDraft((d) => ({ ...d, images: next }))}
          />
        </div>
        <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t p-4 sm:p-5" style={{ borderColor: "var(--line)" }}>
          <button type="button" disabled={busy} onClick={onClose} className="btn-ghost staff-touch-target">
            {t("common.close")}
          </button>
          <button
            type="button"
            disabled={busy}
            className="btn-primary staff-touch-target"
            onClick={() => void (async () => {
              setBusy(true);
              try {
                await onSave(ensureProductOrderable({ ...draft, images: [...(draft.images ?? [])] }));
              } finally {
                setBusy(false);
              }
            })()}
          >
            {t("staff.images.save")}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ProductEditor({
  product,
  collections,
  isCreating,
  cloudUpload,
  onCancel,
  onSave,
}: {
  product: Product;
  collections: Collection[];
  isCreating: boolean;
  cloudUpload: boolean;
  onCancel: () => void;
  onSave: (p: Product) => void | Promise<void>;
}) {
  const { t, locale } = useLocale();
  const { site } = useStore();
  const [draft, setDraft] = useState<Product>(() => ({
    ...product,
    priceOptions: product.priceOptions ?? emptyPriceOptions(),
  }));
  const [saving, setSaving] = useState(false);
  const categoryOptions = useMemo(() => catalogFilterSlugs(site), [site]);
  const update = <K extends keyof Product>(k: K, v: Product[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));
  useBodyScrollLock(true);

  return (
    <div className="staff-modal-root z-50 flex items-stretch justify-center sm:justify-end">
      <div
        className="staff-modal-backdrop"
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={onCancel}
        onTouchEnd={(e) => {
          if (e.target === e.currentTarget) onCancel();
        }}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className="staff-modal-panel flex h-modal-viewport w-full max-w-6xl flex-col overflow-hidden overscroll-contain pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] sm:h-auto sm:max-h-[100dvh] md:flex-row"
        style={{ background: "var(--background)", borderInlineStart: "1px solid var(--line)" }}
      >
        <aside
          className="max-h-[32vh] shrink-0 overflow-y-auto border-b p-4 sm:max-h-[38vh] sm:p-5 md:max-h-none md:w-[min(100%,380px)] md:border-b-0 md:border-e md:p-6"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          <ProductStaffPreview key={draft.id} draft={draft} collections={collections} />
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="flex shrink-0 items-center justify-between gap-3 p-4 sm:p-6" style={{ borderBottom: "1px solid var(--line)" }}>
            <h3 className="min-w-0 flex-1 break-words font-display text-xl sm:text-2xl">{isCreating ? t("staff.form.newTitle") : t("staff.form.editTitle")}</h3>
            <button type="button" onClick={onCancel} className="staff-touch-target flex h-11 w-11 flex-shrink-0 items-center justify-center" aria-label={t("staff.aria.close")}>
              <X className="h-5 w-5" strokeWidth={1.4} />
            </button>
          </div>
          <form
            className="space-y-5 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] sm:p-6"
            onSubmit={async (e) => {
              e.preventDefault();
              if (saving) return;
              setSaving(true);
              try {
                await onSave(ensureProductOrderable(draft));
              } finally {
                setSaving(false);
              }
            }}
          >
          <Field label={t("staff.form.name")}>
            <input className="staff-input" value={draft.name} onChange={(e) => update("name", e.target.value)} required />
          </Field>
          <Field label={t("staff.form.slug")}>
            <input className="staff-input" value={draft.slug} onChange={(e) => update("slug", slugify(e.target.value))} placeholder={t("staff.form.slugPlaceholder")} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("staff.form.price")}>
              <input type="number" className="staff-input" min="0" value={draft.price} onChange={(e) => update("price", Number(e.target.value))} required />
            </Field>
            <Field label={t("staff.form.currency")}>
              <select className="staff-input" value={draft.currency} onChange={(e) => update("currency", e.target.value as Currency)}>
                {(["EUR", "USD", "AED", "JPY", "IQD"] as const).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={t("staff.form.stock")}>
            <input
              type="number"
              className="staff-input"
              min="0"
              value={draft.stock ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                update("stock", v === "" ? null : Math.max(0, Number(v)));
              }}
              placeholder={t("staff.form.stockPlaceholder")}
            />
            <p className="mt-1 text-xs opacity-70">{t("staff.form.stockHint")}</p>
          </Field>
          <div className="border-t pt-5" style={{ borderColor: "var(--line)" }}>
            <PriceOptionsEditor
              priceOptions={draft.priceOptions ?? emptyPriceOptions()}
              imageCount={draft.images.length}
              onChange={(next) => update("priceOptions", next)}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("staff.form.collection")}>
              <select className="staff-input" value={draft.collection} onChange={(e) => update("collection", e.target.value)}>
                {collections.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label={t("staff.form.category")}>
              <select className="staff-input" value={draft.category} onChange={(e) => update("category", e.target.value)}>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {productCategoryLabel(c, site, t, locale)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={t("staff.form.materials")}>
            <input
              className="staff-input"
              value={draft.materials.join(", ")}
              onChange={(e) =>
                update("materials", e.target.value.split(",").map((s) => s.trim()).filter(Boolean) as Material[])
              }
            />
          </Field>
          <Field label={t("staff.form.stones")}>
            <input
              className="staff-input"
              value={draft.stones.join(", ")}
              onChange={(e) =>
                update("stones", e.target.value.split(",").map((s) => s.trim()).filter(Boolean) as Stone[])
              }
            />
          </Field>
          <ImagesField
            cloudUpload={cloudUpload}
            images={draft.images}
            onChange={(next) => update("images", next)}
          />
          <VideosField
            cloudUpload={cloudUpload}
            videos={draft.videos ?? []}
            onChange={(next) => update("videos", next.length > 0 ? next : undefined)}
          />
          <Field label={t("staff.form.description")}>
            <textarea className="staff-input" rows={3} value={draft.description} onChange={(e) => update("description", e.target.value)} />
          </Field>
          <Field label={t("staff.form.story")}>
            <textarea className="staff-input" rows={5} value={draft.story} onChange={(e) => update("story", e.target.value)} />
          </Field>
          <div className="border-t pt-5" style={{ borderColor: "var(--line)" }}>
            <CategorySizesEditor
              sizeOptions={draft.sizeOptions}
              category={draft.category}
              site={site}
              onChange={(next) => update("sizeOptions", next)}
            />
          </div>
          <Field label={t("staff.form.related")}>
            <input
              className="staff-input"
              value={(draft.related ?? []).join(", ")}
              onChange={(e) => update("related", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            />
          </Field>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!draft.isNew} onChange={(e) => update("isNew", e.target.checked)} />
              {t("staff.form.flagNew")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!draft.isHighJewelry} onChange={(e) => update("isHighJewelry", e.target.checked)} />
              {t("staff.form.flagHighJewelry")}
            </label>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4">
            <button type="button" disabled={saving} onClick={onCancel} className="btn-ghost staff-touch-target">{t("staff.form.cancel")}</button>
            <button type="submit" disabled={saving} className="btn-primary staff-touch-target min-w-[8rem]">
              {saving ? t("staff.form.saving") : t("staff.form.save")}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}

function ProductStaffPreview({
  draft,
  collections,
}: {
  draft: Product;
  collections: Collection[];
}) {
  const { t, locale } = useLocale();
  const { site } = useStore();
  const [imgIdx, setImgIdx] = useState(0);
  const collectionName = collections.find((c) => c.slug === draft.collection)?.name ?? draft.collection;
  const gallery = productGallerySources(draft);
  const safeIdx = Math.min(imgIdx, Math.max(0, gallery.length - 1));
  const mainSrc = gallery[safeIdx] ?? productImageAt(draft, 0);
  const previewSizeGroups = getProductSizeGroups(draft, site);
  const sizeKind = productSizeKindForCategory(draft.category, site);
  const enabledEmptyKinds = enabledEmptySizeKinds(draft.sizeOptions);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <p className="staff-label !mb-1">{t("staff.preview.title")}</p>
        <p className="text-xs leading-relaxed opacity-70">{t("staff.preview.hint")}</p>
      </div>
      <div className="overflow-hidden border" style={{ borderColor: "var(--line)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mainSrc}
          alt=""
          className="aspect-[4/5] max-h-[min(52vh,420px)] w-full bg-[var(--background)] object-cover md:max-h-[min(70vh,520px)]"
        />
      </div>
      {gallery.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {gallery.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              className="overflow-hidden border-2 transition-opacity"
              style={{
                borderColor: i === safeIdx ? "var(--color-gold)" : "var(--line)",
                opacity: i === safeIdx ? 1 : 0.75,
              }}
              onClick={() => setImgIdx(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-12 w-12 object-cover" />
            </button>
          ))}
        </div>
      )}
      <div className="space-y-3 text-sm">
        <h4 className="font-display text-xl leading-snug sm:text-2xl">{draft.name.trim() || "—"}</h4>
        <p className="font-display text-lg opacity-90">
          {formatPrice(getProductListingPrice(draft), draft.currency, locale)}
        </p>
        {getActivePriceSlots(draft).length > 1 && (
          <ul className="space-y-1 text-sm opacity-85">
            {getActivePriceSlots(draft).map((slot) => (
              <li key={slot.index}>
                {priceSlotLabel(slot, t)}: {formatPrice(slot.amount, draft.currency, locale)}
              </li>
            ))}
          </ul>
        )}
        {isStockTracked(draft) && (
          <p className="text-xs uppercase tracking-eyebrow opacity-70">
            {!isProductInStock(draft)
              ? t("staff.preview.stockOut")
              : draft.stock != null && draft.stock > 0
                ? t("staff.preview.stockQty").replace("{n}", String(draft.stock))
                : t("staff.preview.stockIn")}
          </p>
        )}
        <dl className="space-y-1.5 text-[11px] uppercase tracking-[0.2em] opacity-75">
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            <dt className="shrink-0 opacity-60">{t("staff.preview.slug")}</dt>
            <dd className="min-w-0 break-all font-normal normal-case tracking-normal">{draft.slug.trim() || "—"}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            <dt className="shrink-0 opacity-60">{t("staff.preview.collection")}</dt>
            <dd className="min-w-0 font-normal normal-case tracking-normal">{collectionName}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            <dt className="shrink-0 opacity-60">{t("filter.category")}</dt>
            <dd className="font-normal">{productCategoryLabel(draft.category, site, t, locale)}</dd>
          </div>
        </dl>
        {!!draft.materials?.length && (
          <p className="text-xs leading-relaxed">
            <span className="block uppercase tracking-eyebrow opacity-60">{t("common.materials")}</span>
            <span className="text-sm opacity-90">{draft.materials.map((m) => t(`material.${m}`)).join(" · ")}</span>
          </p>
        )}
        {!!draft.stones?.length && draft.stones.some((s) => s !== "none") && (
          <p className="text-xs leading-relaxed">
            <span className="block uppercase tracking-eyebrow opacity-60">{t("common.stones")}</span>
            <span className="text-sm opacity-90">
              {draft.stones.filter((s) => s !== "none").map((s) => t(`stone.${s}`)).join(" · ")}
            </span>
          </p>
        )}
        <div className="border-t pt-3" style={{ borderColor: "var(--line)" }}>
          <p className="staff-label !mb-2">{t("common.size")}</p>
          {!sizeKind && previewSizeGroups.length === 0 && enabledEmptyKinds.length === 0 && (
            <p className="text-sm leading-relaxed opacity-75">{t("staff.preview.noSizes")}</p>
          )}
          {sizeKind && previewSizeGroups.length === 0 && enabledEmptyKinds.length === 0 && (
            <p className="text-sm leading-relaxed opacity-75">{t("staff.preview.sizesOptional")}</p>
          )}
          {enabledEmptyKinds.length > 0 && (
            <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-400/95">
              {t("staff.preview.sizesEmpty")}
            </p>
          )}
          {previewSizeGroups.length > 0 && (
            <div className="space-y-3">
              {previewSizeGroups.map((group) => (
                <div key={group.kind}>
                  <p className="mb-1.5 text-[10px] uppercase tracking-eyebrow opacity-60">
                    {previewSizeGroups.length > 1
                      ? t(sizeKindLabelKey(group.kind))
                      : t("common.size")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.sizes.map((s) => (
                      <span
                        key={`${group.kind}-${s}`}
                        className="border px-2.5 py-1 text-xs sm:text-sm"
                        style={{ borderColor: "var(--line)" }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {draft.description?.trim() && (
          <p
            className="border-t pt-3 text-sm leading-relaxed opacity-85 line-clamp-6"
            style={{ borderColor: "var(--line)" }}
          >
            {draft.description}
          </p>
        )}
      </div>
    </div>
  );
}

function PriceOptionsEditor({
  priceOptions,
  imageCount,
  onChange,
}: {
  priceOptions: ProductPriceOptions;
  imageCount: number;
  onChange: (next: ProductPriceOptions) => void;
}) {
  const { t } = useLocale();
  const slots = priceOptions.length >= PRICE_SLOT_COUNT ? priceOptions : emptyPriceOptions();

  const updateSlot = (index: number, patch: Partial<ProductPriceSlot>) => {
    const next = slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot));
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="staff-label !mb-0">{t("staff.prices.title")}</p>
        <p className="mt-1 text-xs opacity-75">{t("staff.prices.hint")}</p>
      </div>
      <div className="space-y-3">
        {Array.from({ length: PRICE_SLOT_COUNT }, (_, index) => {
          const slot = slots[index]!;
          const imageHint = imageCount > 0 && index < imageCount;
          return (
            <div
              key={index}
              className="grid grid-cols-1 items-center gap-3 rounded border p-3 sm:grid-cols-[auto_1fr_1fr]"
              style={{
                borderColor: slot.enabled ? "var(--color-gold)" : "var(--line)",
                background: slot.enabled ? "color-mix(in srgb, var(--color-gold) 5%, transparent)" : undefined,
              }}
            >
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={slot.enabled}
                  onChange={(e) => updateSlot(index, { enabled: e.target.checked })}
                />
                <span className="whitespace-nowrap text-[11px] uppercase tracking-eyebrow">
                  {t("staff.prices.slot").replace("{n}", String(index + 1))}
                  {imageHint ? ` · ${t("staff.prices.image")} ${index + 1}` : ""}
                </span>
              </label>
              <input
                type="number"
                className="staff-input"
                min="0"
                disabled={!slot.enabled}
                value={slot.enabled ? slot.amount : ""}
                onChange={(e) => updateSlot(index, { amount: Math.max(0, Number(e.target.value)) })}
                placeholder={t("staff.prices.amount")}
              />
              <input
                className="staff-input"
                disabled={!slot.enabled}
                value={slot.label ?? ""}
                onChange={(e) => updateSlot(index, { label: e.target.value })}
                placeholder={t("staff.prices.labelPlaceholder")}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CategorySizesEditor({
  sizeOptions,
  category,
  site,
  onChange,
}: {
  sizeOptions: ProductSizeOptions | undefined;
  category: string;
  site: SiteContent;
  onChange: (next: ProductSizeOptions | undefined) => void;
}) {
  const { t } = useLocale();
  const options = sizeOptions ?? {};
  const activeKind = productSizeKindForCategory(category, site);

  const updateKind = (kind: ProductSizeKind, list: string[] | undefined) => {
    const next = { ...options };
    if (list === undefined) delete next[kind];
    else next[kind] = list;
    onChange(Object.keys(next).length > 0 ? next : undefined);
  };

  return (
    <div className="space-y-5">
      <p className="staff-label !mb-0">{t("common.size")}</p>
      <p className="text-xs opacity-75">{t("staff.sizes.hint")}</p>
      {(["necklace", "bracelet", "ring"] as const).map((kind) => (
        <SizeGroupEditor
          key={kind}
          kind={kind}
          enabled={isSizeKindEnabled(sizeOptions, kind)}
          list={options[kind] ?? []}
          highlighted={activeKind === kind}
          onEnabledChange={(on) => updateKind(kind, on ? (options[kind] ?? []) : undefined)}
          onListChange={(list) => {
            if (isSizeKindEnabled(sizeOptions, kind) || list.length > 0) updateKind(kind, list);
            else updateKind(kind, undefined);
          }}
        />
      ))}
    </div>
  );
}

function SizeGroupEditor({
  kind,
  enabled,
  list,
  highlighted,
  onEnabledChange,
  onListChange,
}: {
  kind: ProductSizeKind;
  enabled: boolean;
  list: string[];
  highlighted: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onListChange: (list: string[]) => void;
}) {
  const { t } = useLocale();
  const [input, setInput] = useState("");

  const addSize = () => {
    const v = input.trim();
    if (v && !list.includes(v)) onListChange([...list, v]);
    setInput("");
  };

  return (
    <div
      className="space-y-3 rounded border p-4"
      style={{
        borderColor: highlighted ? "var(--color-gold)" : "var(--line)",
        background: highlighted ? "color-mix(in srgb, var(--color-gold) 6%, transparent)" : undefined,
      }}
    >
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        <span>
          <span className="staff-label !mb-0 block">{t(`staff.sizes.${kind}.enable`)}</span>
          <span className="mt-1 block text-xs opacity-75">{t(`staff.sizes.${kind}.hint`)}</span>
        </span>
      </label>
      {enabled && (
        <>
          <div className="flex flex-wrap gap-2">
            {SIZE_PRESETS[kind].map((preset) => (
              <button
                key={preset}
                type="button"
                className="btn-ghost px-3 py-1 text-[11px] tracking-eyebrow uppercase"
                onClick={() => {
                  if (!list.includes(preset)) onListChange([...list, preset]);
                }}
              >
                {preset}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className="staff-input min-w-[140px] flex-1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("staff.sizes.placeholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSize();
                }
              }}
            />
            <button
              type="button"
              className="btn-ghost whitespace-nowrap px-4 text-[11px] tracking-eyebrow uppercase"
              onClick={addSize}
            >
              {t("staff.sizes.add")}
            </button>
          </div>
          {list.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {list.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 border px-2.5 py-1 text-sm"
                  style={{ borderColor: "var(--line)" }}
                >
                  {s}
                  <button
                    type="button"
                    aria-label={`${t("staff.sizes.remove")}: ${s}`}
                    className="opacity-70 hover:opacity-100"
                    onClick={() => onListChange(list.filter((x) => x !== s))}
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.4} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <button
            type="button"
            className="text-[11px] uppercase tracking-eyebrow opacity-70 hover:opacity-100"
            onClick={() => onListChange([])}
          >
            {t("staff.sizes.clearAll")}
          </button>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="staff-label">{label}</span>
      {children}
    </label>
  );
}

function ImagesField({
  images,
  onChange,
  cloudUpload = false,
}: {
  images: string[];
  onChange: (next: string[]) => void;
  cloudUpload?: boolean;
}) {
  const { t } = useLocale();
  const { staffCloudUpload, confirmR2Ready } = useStore();
  const useCloud = cloudUpload || staffCloudUpload;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const accepted: string[] = [];
    const errors: string[] = [];
    const list = Array.from(files);
    if (useCloud) setBusy(true);
    try {
      for (const file of list) {
        if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name)) {
          errors.push(t("staff.images.notImage").replace("{name}", file.name));
          continue;
        }
        if (file.size <= 0) {
          errors.push(t("staff.images.uploadErr.empty_file"));
          continue;
        }
        if (useCloud) {
          const up = await uploadStaffImageFile(file, "products", { onSuccess: confirmR2Ready });
          if (up.ok) accepted.push(up.url);
          else if (up.code === "unauthorized") errors.push(translateStaffUploadError("unauthorized", t));
          else errors.push(`${file.name}: ${translateStaffUploadError(up.code, t)}`);
          await yieldToMain();
        } else {
          try {
            const dataUrl = await readFileAsDataUrl(file);
            if (dataUrl) accepted.push(dataUrl);
          } catch {
            errors.push(file.name);
          }
          await yieldToMain();
        }
      }
      if (accepted.length > 0) onChange([...images, ...accepted]);
      if (errors.length > 0) setError(errors.join(" "));
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      if (useCloud) setBusy(false);
    }
  };

  const removeAt = (idx: number) => {
    const next = images.slice();
    next.splice(idx, 1);
    onChange(next);
    resetFileInput();
  };

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openFilePicker = () => {
    if (busy) return;
    resetFileInput();
    fileInputRef.current?.click();
  };

  const hintKey = useCloud ? "staff.images.uploadHintCloud" : "staff.images.uploadHint";

  return (
    <div>
      <p className="staff-label">{t("staff.images.title")}</p>
      <Field label={t("staff.images.urls")}>
        <textarea
          className="staff-input"
          rows={3}
          value={images.join("\n")}
          dir="ltr"
          style={{ textAlign: "left" }}
          onChange={(e) =>
            onChange(
              e.target.value
                .split("\n")
                .map((s) => normalizeStaffMediaUrl(s.trim()))
                .filter(Boolean),
            )
          }
          onBlur={(e) =>
            onChange(
              e.target.value
                .split("\n")
                .map((s) => normalizeStaffMediaUrl(s.trim()))
                .filter(Boolean),
            )
          }
        />
      </Field>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={busy}
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={openFilePicker}
          className="btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="h-4 w-4" strokeWidth={1.4} /> {busy ? t("staff.images.uploading") : t("staff.images.upload")}
        </button>
        <span className="text-[11px] opacity-65">{t(hintKey)}</span>
      </div>
      {error && (
        <p className="mt-2 text-xs" style={{ color: "var(--color-bordeaux)" }}>
          {error}
        </p>
      )}
      {images.length > 0 && (
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {images.map((src, idx) => (
            <li
              key={src + idx}
              className="relative aspect-square overflow-hidden"
              style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
              <button
                type="button"
                aria-label={t("staff.images.remove")}
                onClick={() => removeAt(idx)}
                className="absolute end-1 top-1 flex h-7 w-7 items-center justify-center rounded-full"
                style={{
                  background: "color-mix(in srgb, var(--background) 85%, transparent)",
                  border: "1px solid var(--line)",
                }}
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VideosField({
  videos,
  onChange,
  cloudUpload = false,
}: {
  videos: string[];
  onChange: (next: string[]) => void;
  cloudUpload?: boolean;
}) {
  const { t } = useLocale();
  const { staffCloudUpload, r2PresignConfigured, confirmR2Ready } = useStore();
  const useCloud = cloudUpload || staffCloudUpload;
  const r2StatusPending = r2PresignConfigured === null && !useCloud;
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasVideo = videos.length > 0;

  const openFilePicker = () => {
    if (busy) return;
    if (fileInputRef.current) fileInputRef.current.value = "";
    fileInputRef.current?.click();
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setSuccess(null);
    if (!useCloud) {
      setError(
        r2StatusPending
          ? t("staff.videos.checkingHint")
          : t("staff.images.uploadErr.video_not_supported_without_r2"),
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const accepted: string[] = [];
    const errors: string[] = [];
    const list = Array.from(files);
    setBusy(true);
    try {
      for (const file of list) {
        const videoMime = staffVideoMimeFromFile(file);
        if (!isAllowedStaffVideoMime(videoMime)) {
          errors.push(t("staff.videos.notVideo").replace("{name}", file.name));
          continue;
        }
        if (file.size <= 0) {
          errors.push(t("staff.images.uploadErr.empty_file"));
          continue;
        }
        setUploadingName(file.name);
        const up = await uploadStaffMediaFile(file, "product", {
          onSuccess: confirmR2Ready,
          onProgress: ({ fileName }) => setUploadingName(fileName),
        });
        if (up.ok) accepted.push(up.url);
        else if (up.code === "unauthorized") errors.push(translateStaffUploadError("unauthorized", t));
        else errors.push(`${file.name}: ${translateStaffUploadError(up.code, t)}`);
        await yieldToMain();
      }
      if (accepted.length > 0) {
        onChange([...videos, ...accepted]);
        setSuccess(
          accepted.length === 1
            ? t("staff.videos.uploadSuccess").replace("{url}", accepted[0]!)
            : t("staff.videos.uploadSuccessCount").replace("{count}", String(accepted.length)),
        );
      }
      if (errors.length > 0) setError(errors.join(" "));
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setBusy(false);
      setUploadingName(null);
    }
  };

  const removeAt = (idx: number) => {
    const next = videos.slice();
    next.splice(idx, 1);
    onChange(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div>
      <p className="staff-label">{t("staff.videos.title")}</p>
      <Field label={t("staff.videos.urls")}>
        <textarea
          className="staff-input"
          rows={2}
          value={videos.join("\n")}
          dir="ltr"
          style={{ textAlign: "left" }}
          onChange={(e) =>
            onChange(
              e.target.value
                .split("\n")
                .map((s) => normalizeStaffMediaUrl(s.trim()))
                .filter(Boolean),
            )
          }
          onBlur={(e) =>
            onChange(
              e.target.value
                .split("\n")
                .map((s) => normalizeStaffMediaUrl(s.trim()))
                .filter(Boolean),
            )
          }
        />
      </Field>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          multiple
          className="hidden"
          disabled={busy}
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={openFilePicker}
          className="btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="h-4 w-4" strokeWidth={1.4} />{" "}
          {busy
            ? uploadingName
              ? t("staff.videos.uploadingFile").replace("{name}", uploadingName)
              : t("staff.images.uploading")
            : hasVideo
              ? t("staff.videos.addAnother")
              : t("staff.videos.upload")}
        </button>
        <span className="text-[11px] opacity-65">
          {useCloud
            ? hasVideo
              ? t("staff.videos.addAnotherHint")
              : t("staff.videos.uploadHint")
            : r2StatusPending
              ? t("staff.videos.checkingHint")
              : t("staff.videos.setupHint")}
        </span>
      </div>
      {success && (
        <p className="mt-2 break-all text-xs opacity-80" dir="ltr" style={{ textAlign: "left" }}>
          {success}
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs" style={{ color: "var(--color-bordeaux)" }}>
          {error}
        </p>
      )}
      {videos.length > 0 && (
        <ul className="mt-4 space-y-3">
          {videos.map((src, idx) => (
            <li key={src + idx} className="flex items-center gap-3">
              <video
                src={src}
                controls
                playsInline
                preload="metadata"
                className="max-h-28 w-full max-w-xs"
                style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
              />
              <button
                type="button"
                aria-label={t("staff.images.remove")}
                onClick={() => removeAt(idx)}
                className="btn-ghost shrink-0"
              >
                <X className="h-4 w-4" strokeWidth={1.4} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function paymentMethodLabel(method: string | undefined, t: (key: string) => string) {
  if (!method) return "—";
  if (method === "cod") return t("staff.pay.cod");
  if (method === "mastercard") return t("staff.pay.mastercard");
  if (method === "zaincash") return t("staff.pay.zaincash");
  return method;
}

const STATUS_OPTIONS = ["pending", "preparing", "shipped", "delivered", "cancelled"] as const;

function staffOrderRevenueUsd(order: Order, usdIqdRate: number) {
  const rateOpts = { usdIqdRate };
  const iqd = orderRevenueIqd(order, rateOpts);
  return { iqd, usd: iqdToUsd(iqd, rateOpts) };
}

function orderLineThumbnail(productId: string, products: Product[]): string {
  const p = products.find((x) => x.id === productId);
  return p ? productImageAt(p, 0) : MUHRA_PLACEHOLDER_IMAGE;
}

function OrdersPane() {
  const { orders, products, setOrderStatus, removeOrder, site } = useStore();
  const { t, locale } = useLocale();
  const usdIqdRate = getUsdIqdRate(site);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpanded((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!ql) return true;
      const haystacks = [
        o.id,
        o.customerName,
        o.customer?.phone ?? "",
        o.customer?.governorate ?? "",
        o.customer?.country ?? "",
        o.customer?.city ?? "",
        o.customer?.address ?? "",
        o.payment?.method ?? "",
      ];
      return haystacks.some((h) => h.toLowerCase().includes(ql));
    });
  }, [orders, q, statusFilter]);

  return (
    <section>
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="font-display min-w-0 break-words text-2xl sm:text-3xl">{t("staff.orders.titleCount").replace("{n}", String(orders.length))}</h2>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            className="staff-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "all")}
            style={{ padding: "0.55rem 0.7rem" }}
          >
            <option value="all">{t("staff.orders.filterAll")}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {t(`staff.status.${s}` as "staff.status.pending")}
              </option>
            ))}
          </select>
          <input
            className="staff-input w-full min-w-0 sm:max-w-xs"
            placeholder={t("staff.orders.searchPlaceholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </header>
      <div className="staff-table-wrap mt-6 overflow-x-auto staff-card p-0">
        <table className="staff-table min-w-[720px]">
          <thead>
            <tr>
              <th></th>
              <th>{t("staff.orders.id")}</th>
              <th>{t("staff.orders.date")}</th>
              <th>{t("staff.orders.customer")}</th>
              <th>{t("staff.orders.location")}</th>
              <th>{t("staff.orders.phone")}</th>
              <th>{t("staff.orders.payment")}</th>
              <th>{t("staff.orders.total")}</th>
              <th>{t("staff.orders.status")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="py-12 text-center opacity-60">
                  No orders yet — try a demo checkout from the bag.
                </td>
              </tr>
            )}
            {filtered.map((o) => {
              const isOpen = expanded.has(o.id);
              const international =
                Boolean(o.customer?.international) || !isIraqCountry(o.customer?.country);
              const countryCode = o.customer?.country ?? "IQ";
              const countryLabel = t(`country.${countryCode}`);
              const govLabel = o.customer?.governorate
                ? t(`governorate.${o.customer.governorate}`)
                : "—";
              const locationLabel = international
                ? `${countryLabel}${o.customer?.city ? ` · ${o.customer.city}` : ""}`
                : `${govLabel}${o.customer?.city ? ` · ${o.customer.city}` : ""}`;
              return (
                <FragmentRow key={o.id}>
                  <tr
                    className="cursor-pointer"
                    onClick={() => toggleExpand(o.id)}
                  >
                    <td style={{ width: 28 }}>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 opacity-60" strokeWidth={1.5} />
                      ) : (
                        <ChevronRight className="h-4 w-4 opacity-60" strokeWidth={1.5} />
                      )}
                    </td>
                    <td className="font-mono text-xs">{o.id}</td>
                    <td className="opacity-80">{formatDate(o.createdAt, locale)}</td>
                    <td>{o.customerName}</td>
                    <td className="opacity-80">
                      {locationLabel}
                      {international && (
                        <span
                          className="ms-2 inline-block px-2 py-0.5 text-[9px] tracking-eyebrow uppercase"
                          style={{
                            border: "1px solid var(--color-gold)",
                            color: "var(--color-gold)",
                          }}
                        >
                          {t("staff.orders.international")}
                        </span>
                      )}
                    </td>
                    <td className="opacity-80 font-mono text-xs">{o.customer?.phone ?? "—"}</td>
                    <td>
                      {o.payment?.method ? (
                        <span
                          className="inline-block px-2 py-0.5 text-[10px] tracking-eyebrow uppercase"
                          style={{
                            border: "1px solid var(--line-strong)",
                            background: "var(--surface)",
                          }}
                        >
                          {paymentMethodLabel(o.payment.method, t)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {(() => {
                        const { usd, iqd } = staffOrderRevenueUsd(o, usdIqdRate);
                        return (
                          <div className="flex flex-col">
                            <span>{formatPrice(usd, "USD", locale)}</span>
                            <span className="text-[10px] opacity-65">≈ {formatIqd(iqd, locale)}</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select
                        className="staff-input"
                        value={o.status}
                        onChange={(e) => void setOrderStatus(o.id, e.target.value as OrderStatus)}
                        style={{ padding: "0.4rem 0.5rem" }}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {t(`staff.status.${s}` as "staff.status.pending")}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          aria-label={t("staff.aria.remove")}
                          onClick={() => void removeOrder(o.id)}
                          className="opacity-70 hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.4} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={10} style={{ background: "var(--surface)" }}>
                        <div className="p-6 grid gap-6 md:grid-cols-2">
                          <div>
                            <p className="eyebrow">{t("staff.orders.address")}</p>
                            <p className="mt-2 text-sm leading-relaxed">
                              <span className="font-medium">{o.customerName}</span>
                              <br />
                              {o.customer?.phone}
                              <br />
                              {o.customer?.address}
                              {o.customer?.city ? `, ${o.customer.city}` : ""}
                              <br />
                              {international ? (
                                countryLabel
                              ) : (
                                <>
                                  {govLabel} — {t("staff.orders.countryIraq")}
                                </>
                              )}
                              {international && (
                                <span
                                  className="ms-2 inline-block px-2 py-0.5 text-[9px] tracking-eyebrow uppercase"
                                  style={{
                                    border: "1px solid var(--color-gold)",
                                    color: "var(--color-gold)",
                                  }}
                                >
                                  {t("staff.orders.international")}
                                </span>
                              )}
                            </p>
                            {o.customer?.notes && (
                              <>
                                <p className="eyebrow mt-4">{t("staff.orders.notes")}</p>
                                <p className="mt-2 text-sm opacity-80">{o.customer.notes}</p>
                              </>
                            )}
                            <p className="eyebrow mt-4">{t("staff.orders.payment")}</p>
                            <p className="mt-2 text-sm">
                              {o.payment?.method ? paymentMethodLabel(o.payment.method, t) : "—"}
                              {o.payment?.cardLast4 ? ` · •••• ${o.payment.cardLast4}` : ""}
                              {o.payment?.zaincashPhone ? ` · ${o.payment.zaincashPhone}` : ""}
                            </p>
                          </div>
                          <div>
                            <p className="eyebrow">{t("staff.orders.items")}</p>
                            <ul className="mt-2 space-y-2">
                              {o.items.map((it, idx) => {
                                const p = products.find((x) => x.id === it.productId);
                                const thumbSrc = orderLineThumbnail(it.productId, products);
                                const sizeLabel = formatOrderSizeDisplay(it.size, t);
                                return (
                                  <li
                                    key={idx}
                                    className="flex items-center gap-3"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={thumbSrc}
                                      alt=""
                                      className="h-12 w-12 shrink-0 border object-cover"
                                      style={{ borderColor: "var(--line)" }}
                                    />
                                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="text-sm">{it.name}</p>
                                        <p className="text-[11px] opacity-65">
                                          {it.qty} × {formatPrice(it.price, o.currency, locale)}
                                          {sizeLabel ? ` · ${sizeLabel}` : ""}
                                          {p ? ` · /${p.slug}` : ""}
                                        </p>
                                      </div>
                                      <p className="shrink-0 text-sm">
                                        {formatPrice(it.qty * it.price, o.currency, locale)}
                                      </p>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                            <div className="hairline my-4" />
                            <div className="flex items-center justify-between text-sm">
                              <span className="opacity-75">{t("common.subtotal")}</span>
                              <span>{formatPrice(o.subtotal, o.currency, locale)}</span>
                            </div>
                            {typeof o.discountAmountIqd === "number" && o.discountAmountIqd > 0 && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="opacity-75">
                                  {t("checkout.discount.line")}
                                  {o.discountCode ? ` (${o.discountCode})` : ""}
                                </span>
                                <span style={{ color: "var(--color-bordeaux)" }}>
                                  −{formatIqd(o.discountAmountIqd, locale)}
                                </span>
                              </div>
                            )}
                            {typeof o.shippingFeeIqd === "number" && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="opacity-75">{t("checkout.shipping")}</span>
                                <span>{formatIqd(o.shippingFeeIqd, locale)}</span>
                              </div>
                            )}
                            {international && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="opacity-75">{t("checkout.shipping")}</span>
                                <span className="text-[12px] opacity-75">
                                  {t("checkout.shippingPending")}
                                </span>
                              </div>
                            )}
                            {!international && (
                              <div className="flex items-center justify-between text-sm font-medium">
                                <span className="opacity-75">{t("checkout.total")}</span>
                                <span>
                                  {(() => {
                                    const { usd, iqd } = staffOrderRevenueUsd(o, usdIqdRate);
                                    return (
                                      <>
                                        {formatPrice(usd, "USD", locale)}
                                        <span className="ms-2 text-[11px] font-normal opacity-65">
                                          ≈ {formatIqd(iqd, locale)}
                                        </span>
                                      </>
                                    );
                                  })()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </FragmentRow>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function CollectionsPane() {
  const { collections, site, journal, boutiques, saveStorefront, staffCloudUpload } = useStore();
  const { t } = useLocale();
  const cloudUpload = staffCloudUpload;
  const [draft, setDraft] = useState<Collection[]>(() => collections);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const patchCollection = (id: string, patch: Partial<Collection>) => {
    setDraft((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const saveDraft = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const result = await saveStorefront({ site, collections: draft, journal, boutiques });
      if (result.ok) {
        setSaved(true);
        setDraft(draft);
        setTimeout(() => setSaved(false), 2200);
      } else {
        setSaveError(siteSaveErrorMessage(result.error, t));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="min-w-0 pb-8">
      <header className="mb-6">
        <h2 className="font-display break-words text-2xl sm:text-3xl">
          {t("staff.collections.titleCount").replace("{n}", String(draft.length))}
        </h2>
        <p className="mt-2 text-sm opacity-70">{t("staff.collections.hintSync")}</p>
        <p className="mt-1 text-xs opacity-60">{t("staff.saveOnSiteTab")}</p>
      </header>
      <div className="mt-6 grid min-w-0 gap-4">
        {draft.map((c) => (
          <details key={c.id} className="staff-card min-w-0 p-4 sm:p-5">
            <summary className="cursor-pointer">
              <span className="font-display text-xl">{c.name}</span>
              <span className="ms-3 text-sm opacity-60">/{c.slug}</span>
            </summary>
            <div className="mt-4 grid min-w-0 gap-4">
              <Field label={t("staff.collections.fieldName")}>
                <input
                  className="staff-input w-full"
                  value={c.name}
                  onChange={(e) => patchCollection(c.id, { name: e.target.value })}
                />
              </Field>
              <Field label={t("staff.collections.fieldTagline")}>
                <input
                  className="staff-input w-full"
                  value={c.tagline}
                  onChange={(e) => patchCollection(c.id, { tagline: e.target.value })}
                />
              </Field>
              <Field label={t("staff.collections.fieldDescription")}>
                <textarea
                  className="staff-input w-full"
                  rows={4}
                  value={c.description}
                  onChange={(e) => patchCollection(c.id, { description: e.target.value })}
                />
              </Field>
              <StaffSingleImageField
                label={t("staff.collections.fieldCover")}
                value={c.coverImage}
                cloudUpload={cloudUpload}
                uploadScope="collections"
                onChange={(coverImage) => patchCollection(c.id, { coverImage })}
                onClear={() => patchCollection(c.id, { coverImage: "" })}
              />
              <StaffSingleImageField
                label={t("staff.collections.fieldEditorial")}
                value={c.editorialImage}
                cloudUpload={cloudUpload}
                uploadScope="collections"
                onChange={(editorialImage) => patchCollection(c.id, { editorialImage })}
                onClear={() => patchCollection(c.id, { editorialImage: "" })}
              />
            </div>
          </details>
        ))}
      </div>
      {saveError && (
        <p className="mt-4 text-xs" style={{ color: "var(--color-bordeaux)" }}>
          {saveError}
        </p>
      )}
      <div className="mt-8 flex justify-end">
        <button type="button" disabled={saving} className="btn-primary min-w-[8rem]" onClick={() => void saveDraft()}>
          {saving ? t("staff.site.saving") : saved ? t("staff.site.saved") : t("staff.collections.save")}
        </button>
      </div>
    </section>
  );
}

function JournalPane() {
  const { journal, setJournal, staffCloudUpload } = useStore();
  const { t } = useLocale();
  const onAdd = () => {
    const article: JournalArticle = {
      id: "j-" + Date.now(),
      slug: `chapter-${Date.now()}`,
      title: t("staff.journal.defaultTitle"),
      excerpt: "",
      body: "",
      image: "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=1600&q=80",
      author: t("staff.journal.defaultAuthor"),
      date: new Date().toISOString().slice(0, 10),
      category: t("staff.journal.defaultCategory"),
    };
    setJournal([article, ...journal]);
  };
  const onDelete = (id: string) => {
    if (typeof window !== "undefined" && !window.confirm(t("staff.journal.deleteConfirm"))) return;
    setJournal(journal.filter((a) => a.id !== id));
  };
  return (
    <section>
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display min-w-0 break-words text-2xl sm:text-3xl">{t("staff.journal.titleCount").replace("{n}", String(journal.length))}</h2>
          <p className="mt-2 text-xs opacity-60">{t("staff.saveOnSiteTab")}</p>
        </div>
        <button type="button" onClick={onAdd} className="btn-ghost">
          <Plus className="h-4 w-4" strokeWidth={1.4} /> {t("staff.journal.newArticle")}
        </button>
      </header>
      <div className="mt-6 grid gap-4">
        {journal.map((a) => (
          <details key={a.id} className="staff-card">
            <summary className="cursor-pointer">
              <span className="font-display text-xl">{a.title}</span>
              <span className="ms-3 opacity-60 text-sm">/{a.slug}</span>
            </summary>
            <div className="mt-4 grid gap-4">
              <Field label={t("staff.journal.fieldTitle")}>
                <input
                  className="staff-input"
                  value={a.title}
                  onChange={(e) =>
                    setJournal(journal.map((x) => (x.id === a.id ? { ...x, title: e.target.value } : x)))
                  }
                />
              </Field>
              <Field label={t("staff.journal.fieldSlug")}>
                <input
                  className="staff-input"
                  value={a.slug}
                  onChange={(e) =>
                    setJournal(journal.map((x) => (x.id === a.id ? { ...x, slug: slugify(e.target.value) } : x)))
                  }
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t("staff.journal.fieldAuthor")}>
                  <input className="staff-input" value={a.author} onChange={(e) => setJournal(journal.map((x) => (x.id === a.id ? { ...x, author: e.target.value } : x)))} />
                </Field>
                <Field label={t("staff.journal.fieldDate")}>
                  <input type="date" className="staff-input" value={a.date} onChange={(e) => setJournal(journal.map((x) => (x.id === a.id ? { ...x, date: e.target.value } : x)))} />
                </Field>
              </div>
              <Field label={t("staff.journal.fieldCategory")}>
                <input className="staff-input" value={a.category} onChange={(e) => setJournal(journal.map((x) => (x.id === a.id ? { ...x, category: e.target.value } : x)))} />
              </Field>
              <StaffSingleImageField
                label={t("staff.journal.fieldImage")}
                value={a.image}
                cloudUpload={staffCloudUpload}
                mediaKind="journal"
                onChange={(image) => setJournal(journal.map((x) => (x.id === a.id ? { ...x, image } : x)))}
                onClear={() => setJournal(journal.map((x) => (x.id === a.id ? { ...x, image: "" } : x)))}
              />
              <Field label={t("staff.journal.fieldExcerpt")}>
                <textarea className="staff-input" rows={2} value={a.excerpt} onChange={(e) => setJournal(journal.map((x) => (x.id === a.id ? { ...x, excerpt: e.target.value } : x)))} />
              </Field>
              <Field label={t("staff.journal.fieldBody")}>
                <textarea className="staff-input" rows={8} value={a.body} onChange={(e) => setJournal(journal.map((x) => (x.id === a.id ? { ...x, body: e.target.value } : x)))} />
              </Field>
              <div className="flex justify-end">
                <button type="button" onClick={() => onDelete(a.id)} className="btn-ghost">
                  <Trash2 className="h-4 w-4" strokeWidth={1.4} /> {t("staff.journal.delete")}
                </button>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function siteSaveErrorMessage(code: string, t: (key: string) => string): string {
  const key = `staff.site.saveErr.${code}`;
  const txt = t(key);
  return txt === key ? t("staff.site.saveErr.generic") : txt;
}

function BoutiquesPane() {
  const { boutiques, setBoutiques, staffCloudUpload } = useStore();
  const { t } = useLocale();
  return (
    <section>
      <p className="mb-6 text-xs opacity-60">{t("staff.saveOnSiteTab")}</p>
      <StaffBoutiquesEditor boutiques={boutiques} setBoutiques={setBoutiques} cloudUpload={staffCloudUpload} />
    </section>
  );
}

function SitePane({ onViewProducts }: { onViewProducts?: (slug: string) => void }) {
  const {
    site,
    saveStorefront,
    resetCatalog,
    staffCloudUpload,
    confirmR2Ready,
    products,
    collections,
    journal,
    setJournal,
    boutiques,
    setBoutiques,
    supabaseReady,
    mergeRemoteProduct,
    removeRemoteProduct,
    refreshCatalog,
  } = useStore();
  const { t } = useLocale();
  const cloudMedia = staffCloudUpload;
  const [draft, setDraft] = useState<SiteContent>(() => normalizeSiteContent(site));
  const [collectionsDraft, setCollectionsDraft] = useState<Collection[]>(() => collections);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [assigningProductId, setAssigningProductId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => {
    setCollectionsDraft(collections);
  }, [collections]);

  const saveDraft = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const result = await saveStorefront({
        site: draft,
        collections: collectionsDraft,
        journal,
        boutiques,
      });
      if (result.ok) {
        setSaved(true);
        setDraft(normalizeSiteContent(draft));
        setTimeout(() => setSaved(false), 2200);
      } else {
        setSaveError(siteSaveErrorMessage(result.error, t));
      }
    } finally {
      setSaving(false);
    }
  };

  const assignProductCategory = async (productId: string, categorySlug: string, assign: boolean) => {
    if (!supabaseReady) {
      setAssignError(t("staff.products.remoteRequired"));
      return;
    }
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const custom = (draft.customCategories ?? []).find((c) => c.slug === categorySlug);
    const fallback = custom?.parentCategory ?? "necklaces";
    const targetCategory = assign ? categorySlug : fallback;
    if (product.category === targetCategory) return;
    setAssignError(null);
    setAssigningProductId(productId);
    try {
      const result = await persistProductRemote(
        { ...product, category: targetCategory },
        t,
        mergeRemoteProduct,
        removeRemoteProduct,
        product,
      );
      if (!result.ok) setAssignError(result.error);
    } finally {
      setAssigningProductId(null);
    }
  };

  return (
    <section className="min-w-0 pb-8">
      <header className="mb-6">
        <h2 className="font-display break-words text-2xl sm:text-3xl">{t("staff.site.title")}</h2>
        <p className="mt-2 text-sm opacity-70">{t("staff.site.intro")}</p>
        <p className="mt-2 text-xs leading-relaxed opacity-65">{t("staff.site.saveAllHint")}</p>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void saveDraft();
        }}
        className="flex min-w-0 flex-col gap-6"
      >
        <div className="staff-card grid min-w-0 gap-4 p-5 sm:p-6">
          <p className="eyebrow text-[10px]">{t("staff.site.brandBlockTitle")}</p>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Field label={t("staff.site.brandName")}>
              <input className="staff-input w-full" value={draft.brandName} onChange={(e) => setDraft({ ...draft, brandName: e.target.value })} />
            </Field>
            <Field label={t("staff.site.tagline")}>
              <input className="staff-input w-full" value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} />
            </Field>
            <Field label={t("staff.site.heroHeadline")}>
              <input className="staff-input w-full" value={draft.heroHeadline} onChange={(e) => setDraft({ ...draft, heroHeadline: e.target.value })} />
            </Field>
            <Field label={t("staff.site.supportEmail")}>
              <input className="staff-input w-full" type="email" value={draft.supportEmail} onChange={(e) => setDraft({ ...draft, supportEmail: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("staff.site.heroSubhead")}>
                <textarea className="staff-input w-full" rows={2} value={draft.heroSubhead} onChange={(e) => setDraft({ ...draft, heroSubhead: e.target.value })} />
              </Field>
            </div>
          </div>
        </div>

        <div className="staff-card grid min-w-0 gap-4 p-5 sm:p-6">
          <p className="eyebrow text-[10px]">{t("staff.site.usdRateTitle")}</p>
          <p className="text-sm opacity-70">{t("staff.site.usdRateHint")}</p>
          <div className="max-w-xs">
            <Field label={t("staff.site.usdRateLabel")}>
              <input
                type="number"
                className="staff-input w-full"
                min={500}
                max={10000}
                step={1}
                value={draft.usdIqdRate ?? ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setDraft({
                    ...draft,
                    usdIqdRate: v === "" ? undefined : Math.round(Number(v)),
                  });
                }}
                required
              />
            </Field>
          </div>
        </div>

        <StaffCommerceSettingsEditor draft={draft} setDraft={setDraft} products={products} />

        <StaffSiteTextsEditor draft={draft} setDraft={setDraft} />
        <StaffAllImagesEditor
          draft={draft}
          setDraft={setDraft}
          collectionsDraft={collectionsDraft}
          setCollectionsDraft={setCollectionsDraft}
          journal={journal}
          setJournal={setJournal}
          boutiques={boutiques}
          setBoutiques={setBoutiques}
          cloudUpload={cloudMedia}
          confirmR2Ready={confirmR2Ready}
        />
        <StaffCategoriesEditor draft={draft} setDraft={setDraft} cloudUpload={cloudMedia} />
        <StaffCustomCategoriesEditor
          draft={draft}
          setDraft={setDraft}
          cloudUpload={cloudMedia}
          products={products}
          onViewProducts={onViewProducts}
          onAssignProduct={assignProductCategory}
          assigningProductId={assigningProductId}
        />
        {assignError && (
          <p className="text-sm" style={{ color: "var(--color-bordeaux)" }} role="alert">
            {assignError}
          </p>
        )}
        <StaffHomepageEditor draft={draft} setDraft={setDraft} products={products} cloudUpload={cloudMedia} />

        {saveError && (
          <p className="mt-4 text-xs" style={{ color: "var(--color-bordeaux)" }}>
            {saveError}
          </p>
        )}

        <div className="sticky bottom-0 z-10 mt-8 flex flex-wrap items-center justify-between gap-3 border-t bg-[var(--background)] py-4" style={{ borderColor: "var(--line)" }}>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (confirm(t("staff.site.resetCatalogConfirm"))) resetCatalog();
            }}
            className="btn-ghost text-[10px] sm:text-[11px]"
          >
            {t("staff.site.resetCatalog")}
          </button>
          <button type="submit" disabled={saving} className="btn-primary min-w-[8rem]">
            {saving ? t("staff.site.saving") : saved ? t("staff.site.saved") : t("staff.site.save")}
          </button>
        </div>
      </form>
    </section>
  );
}

function SecurityPane() {
  const { changeCredentials } = useAuth();
  const { t } = useLocale();
  const [current, setCurrent] = useState("");
  const [user, setUser] = useState("");
  const [pwd, setPwd] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <section>
      <h2 className="font-display break-words text-2xl sm:text-3xl">{t("staff.security.title")}</h2>
      <p className="mt-2 opacity-70 text-sm leading-relaxed">
        {t("staff.security.intro")}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null); setMsg(null);
          const ok = await changeCredentials("staff", current, user, pwd);
          if (ok) {
            setMsg(t("staff.security.msgOk"));
            setCurrent(""); setPwd("");
          } else {
            setErr(t("staff.security.errPassword"));
          }
        }}
        className="mt-6 staff-card grid gap-4 max-w-md"
      >
        <Field label={t("staff.security.currentPassword")}>
          <input className="staff-input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </Field>
        <Field label={t("staff.security.newUsername")}>
          <input className="staff-input" value={user} onChange={(e) => setUser(e.target.value)} placeholder={t("staff.security.newUsernamePh")} />
        </Field>
        <Field label={t("staff.security.newPassword")}>
          <input className="staff-input" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} required />
        </Field>
        {err && <p className="text-sm" style={{ color: "var(--color-bordeaux)" }}>{err}</p>}
        {msg && <p className="text-sm" style={{ color: "var(--color-gold-deep)" }}>{msg}</p>}
        <div className="flex justify-end">
          <button type="submit" className="btn-primary">{t("staff.security.update")}</button>
        </div>
      </form>
    </section>
  );
}
