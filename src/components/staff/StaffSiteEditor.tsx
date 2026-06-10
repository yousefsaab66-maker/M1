"use client";

import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { Boutique, Category, Collection, CustomCategory, JournalArticle, Product, SiteContent } from "@/lib/catalog";
import { slugify } from "@/lib/format";
import {
  SITE_COPY_GROUPS,
  type SiteCopyKey,
  patchSiteCopyBundle,
} from "@/lib/site-copy";
import {
  CATEGORY_LANDING_PAGES,
  CATALOG_CATEGORIES,
  HOME_CATEGORY_STRIP,
  countProductsInCategory,
  featuredCollection,
  featuredCollectionSlug,
} from "@/lib/site-display";
import { useStore } from "@/components/providers/StoreProvider";
import { isAllowedStaffVideoMime, staffVideoMimeFromFile } from "@/lib/supabase/storage-constants";
import { productImageAt } from "@/lib/product-media";
import { normalizeStaffMediaUrl } from "@/lib/staff-media-url";
import {
  translateStaffUploadError,
  uploadStaffImageFile,
  uploadStaffMediaFile,
} from "@/lib/staff-upload-client";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="staff-label">{label}</span>
      {children}
    </label>
  );
}

export function StaffSingleImageField({
  label,
  value,
  onChange,
  cloudUpload,
  uploadScope = "site",
  mediaKind,
  onClear,
  compact,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  cloudUpload: boolean;
  uploadScope?: "site" | "collections";
  /** When set, uploads via `/api/staff/upload-media` (e.g. journal). */
  mediaKind?: "journal";
  onClear?: () => void;
  compact?: boolean;
}) {
  const { t } = useLocale();
  const { staffCloudUpload, confirmR2Ready } = useStore();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uploadGenRef = useRef(0);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const useCloud = cloudUpload || staffCloudUpload;

  const resetFileInput = () => {
    if (inputRef.current) inputRef.current.value = "";
  };

  const openFilePicker = () => {
    if (busy || !useCloud) return;
    resetFileInput();
    inputRef.current?.click();
  };

  const isImageFile = (file: File) =>
    file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);

  const handleClear = () => {
    uploadGenRef.current += 1;
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    setError(null);
    resetFileInput();
    onClear?.();
  };

  const onFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || busy) return;
    const gen = (uploadGenRef.current += 1);
    uploadAbortRef.current?.abort();
    const ac = new AbortController();
    uploadAbortRef.current = ac;
    setError(null);
    if (!isImageFile(file)) {
      setError(t("staff.images.notImage").replace("{name}", file.name));
      resetFileInput();
      return;
    }
    if (file.size <= 0) {
      setError(t("staff.images.uploadErr.empty_file"));
      resetFileInput();
      return;
    }
    if (!useCloud) {
      setError(t("staff.site.r2RequiredForImages"));
      resetFileInput();
      return;
    }
    setBusy(true);
    try {
      const up = mediaKind
        ? await uploadStaffMediaFile(file, mediaKind, { onSuccess: confirmR2Ready })
        : await uploadStaffImageFile(file, uploadScope, {
            onSuccess: confirmR2Ready,
            signal: ac.signal,
          });
      if (gen !== uploadGenRef.current) return;
      if (up.ok) onChange(normalizeStaffMediaUrl(up.url));
      else if (up.code !== "aborted") setError(translateStaffUploadError(up.code, t));
    } finally {
      if (gen === uploadGenRef.current) {
        setBusy(false);
        uploadAbortRef.current = null;
      }
      resetFileInput();
    }
  };

  const preview = value.trim() !== "" && (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={value}
      alt=""
      className={compact ? "h-20 w-16 shrink-0 object-cover" : "h-28 w-24 object-cover"}
      style={{ border: "1px solid var(--line)", background: "var(--surface-2)" }}
    />
  );

  return (
    <div className="min-w-0 grid gap-3">
      <Field label={label}>
        <input
          className="staff-input w-full"
          dir="ltr"
          style={{ textAlign: "left" }}
          value={value}
          placeholder="https://media.muhrajewelry.com/…"
          onChange={(e) => onChange(normalizeStaffMediaUrl(e.target.value))}
          onBlur={(e) => onChange(normalizeStaffMediaUrl(e.target.value))}
        />
      </Field>
      <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : ""}`}>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={busy}
          onChange={(e) => void onFiles(e.target.files)}
        />
        <button
          type="button"
          disabled={busy || !useCloud}
          className="btn-ghost shrink-0 text-[10px] sm:text-[11px]"
          onClick={openFilePicker}
        >
          <Upload className="h-4 w-4 shrink-0" strokeWidth={1.4} />
          <span className="truncate">{busy ? t("staff.images.uploading") : t("staff.images.upload")}</span>
        </button>
        {onClear && (
          <button type="button" className="btn-ghost shrink-0 text-[10px] sm:text-[11px]" onClick={handleClear}>
            <RotateCcw className="h-4 w-4 shrink-0" strokeWidth={1.4} />
            <span>{t("staff.site.clearImage")}</span>
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs leading-relaxed" style={{ color: "var(--color-bordeaux)" }}>
          {error}
        </p>
      )}
      {preview}
    </div>
  );
}

export function patchCollectionInList(
  collections: Collection[],
  slug: string,
  patch: Partial<Pick<Collection, "coverImage" | "editorialImage" | "name" | "tagline" | "description">>,
): Collection[] {
  return collections.map((c) => (c.slug === slug ? { ...c, ...patch } : c));
}

function patchCategory(
  draft: SiteContent,
  key: Category,
  patch: { label?: string; image?: string; secondaryImage?: string },
): SiteContent {
  return {
    ...draft,
    categories: {
      ...draft.categories,
      [key]: { ...draft.categories?.[key], ...patch },
    },
  };
}

export function StaffSection({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="staff-card mt-6 min-w-0 overflow-hidden p-5 sm:p-6">
      <header className="border-b pb-4" style={{ borderColor: "var(--line)" }}>
        <h3 className="font-display text-xl sm:text-2xl">{title}</h3>
        {intro && <p className="mt-2 max-w-2xl text-sm leading-relaxed opacity-70">{intro}</p>}
      </header>
      <div className="mt-5 min-w-0">{children}</div>
    </section>
  );
}

function StaffImageGroup({
  title,
  hint,
  children,
  defaultOpen = true,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="staff-image-group" open={defaultOpen}>
      <summary className="staff-image-group__summary cursor-pointer list-none">
        <span className="eyebrow text-[10px] sm:text-[11px]">{title}</span>
      </summary>
      {hint && <p className="mt-2 text-xs leading-relaxed opacity-65">{hint}</p>}
      <div className="mt-4 min-w-0">{children}</div>
    </details>
  );
}

function StaffCategoryImageTile({
  categoryKey,
  draft,
  setDraft,
  cloudUpload,
  extra,
}: {
  categoryKey: Category;
  draft: SiteContent;
  setDraft: React.Dispatch<React.SetStateAction<SiteContent>>;
  cloudUpload: boolean;
  extra?: React.ReactNode;
}) {
  const { t } = useLocale();
  const entry = draft.categories?.[categoryKey] ?? {};
  return (
    <li
      className="staff-image-tile flex min-h-0 flex-col gap-3 p-4 sm:p-5"
      style={{ border: "1px solid var(--line)", background: "var(--surface)" }}
    >
      <span className="font-display text-lg leading-tight">{t(`category.${categoryKey}`)}</span>
      <StaffSingleImageField
        label={t("staff.site.categoryImage")}
        value={entry.image ?? ""}
        cloudUpload={cloudUpload}
        compact
        onChange={(image) => setDraft((d) => patchCategory(d, categoryKey, { image }))}
        onClear={() => setDraft((d) => patchCategory(d, categoryKey, { image: "" }))}
      />
      {extra}
    </li>
  );
}

export function StaffCategoriesEditor({
  draft,
  setDraft,
  cloudUpload,
}: {
  draft: SiteContent;
  setDraft: React.Dispatch<React.SetStateAction<SiteContent>>;
  cloudUpload: boolean;
}) {
  const { t } = useLocale();

  return (
    <StaffSection title={t("staff.site.categoriesTitle")} intro={t("staff.site.categoriesIntro")}>
      <ul className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATALOG_CATEGORIES.map((key) => {
          const entry = draft.categories?.[key] ?? {};
          const systemLabel = t(`category.${key}`);
          const onHome = HOME_CATEGORY_STRIP.includes(key);
          const onLanding = CATEGORY_LANDING_PAGES.includes(key);
          return (
            <li
              key={key}
              className="min-w-0 rounded-sm p-4"
              style={{ border: "1px solid var(--line)", background: "var(--surface)" }}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="eyebrow text-[9px] sm:text-[10px]">{systemLabel}</span>
                <span className="flex flex-wrap gap-1.5">
                  {onHome && (
                    <span
                      className="text-[9px] tracking-eyebrow uppercase opacity-60"
                      style={{ color: "var(--color-gold-deep)" }}
                    >
                      {t("staff.site.onHomepage")}
                    </span>
                  )}
                  {onLanding && (
                    <span
                      className="text-[9px] tracking-eyebrow uppercase opacity-60"
                      style={{ color: "var(--color-gold-deep)" }}
                    >
                      {t("staff.site.onLandingPage")}
                    </span>
                  )}
                </span>
              </div>
              <div className="grid gap-4">
                <Field label={t("staff.site.categoryLabel")}>
                  <input
                    className="staff-input w-full"
                    value={entry.label ?? ""}
                    placeholder={systemLabel}
                    onChange={(e) => setDraft((d) => patchCategory(d, key, { label: e.target.value }))}
                  />
                </Field>
                <p className="text-[11px] leading-relaxed opacity-60">{t("staff.site.categoryImageInHub")}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </StaffSection>
  );
}

function emptyCustomCategory(): CustomCategory {
  return {
    id: "cc-" + Math.random().toString(36).slice(2, 10),
    slug: "",
    labelAr: "",
    labelEn: "",
    image: "",
    parentCategory: undefined,
    showInHomeStrip: false,
  };
}

function patchCustomCategory(
  draft: SiteContent,
  id: string,
  patch: Partial<CustomCategory>,
): SiteContent {
  const list = draft.customCategories ?? [];
  return {
    ...draft,
    customCategories: list.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  };
}

export function StaffCustomCategoriesEditor({
  draft,
  setDraft,
  cloudUpload,
  products = [],
  onViewProducts,
  onAssignProduct,
  assigningProductId,
}: {
  draft: SiteContent;
  setDraft: React.Dispatch<React.SetStateAction<SiteContent>>;
  cloudUpload: boolean;
  products?: Product[];
  onViewProducts?: (slug: string) => void;
  onAssignProduct?: (productId: string, categorySlug: string, assign: boolean) => void | Promise<void>;
  assigningProductId?: string | null;
}) {
  const { t } = useLocale();
  const list = draft.customCategories ?? [];
  const [expandedAssign, setExpandedAssign] = useState<string | null>(null);

  const addCategory = () => {
    setDraft((d) => ({
      ...d,
      customCategories: [...(d.customCategories ?? []), emptyCustomCategory()],
    }));
  };

  const removeCategory = (id: string) => {
    setDraft((d) => ({
      ...d,
      customCategories: (d.customCategories ?? []).filter((c) => c.id !== id),
    }));
  };

  return (
    <StaffSection title={t("staff.site.customCategoriesTitle")} intro={t("staff.site.customCategoriesIntro")}>
      <ul className="grid min-w-0 gap-4">
        {list.map((cat) => {
          const productCount = cat.slug.trim() ? countProductsInCategory(products, cat.slug) : 0;
          const assignOpen = expandedAssign === cat.id;
          return (
          <li
            key={cat.id}
            className="min-w-0 rounded-sm p-4 sm:p-5"
            style={{ border: "1px solid var(--line)", background: "var(--surface)" }}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="eyebrow text-[9px] sm:text-[10px]">
                  {cat.labelAr.trim() || cat.labelEn.trim() || t("staff.site.customCategoryNew")}
                </span>
                {cat.slug.trim() && (
                  <span className="text-[10px] opacity-60">
                    {t("staff.site.customCategoryProductCount").replace("{n}", String(productCount))}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {cat.slug.trim() && onViewProducts && (
                  <button
                    type="button"
                    className="text-[10px] uppercase tracking-eyebrow opacity-70 hover:opacity-100"
                    onClick={() => onViewProducts(cat.slug)}
                  >
                    {t("staff.site.customCategoryViewProducts")}
                  </button>
                )}
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-eyebrow opacity-70 hover:opacity-100"
                  onClick={() => removeCategory(cat.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.4} />
                  {t("staff.site.customCategoryRemove")}
                </button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("staff.site.customCategorySlug")}>
                <input
                  className="staff-input w-full"
                  dir="ltr"
                  style={{ textAlign: "left" }}
                  value={cat.slug}
                  placeholder="womens-rings"
                  onChange={(e) =>
                    setDraft((d) =>
                      patchCustomCategory(d, cat.id, { slug: slugify(e.target.value) }),
                    )
                  }
                />
              </Field>
              <Field label={t("staff.site.customCategoryParent")}>
                <select
                  className="staff-input w-full"
                  value={cat.parentCategory ?? ""}
                  onChange={(e) =>
                    setDraft((d) =>
                      patchCustomCategory(d, cat.id, {
                        parentCategory: (e.target.value || undefined) as Category | undefined,
                      }),
                    )
                  }
                >
                  <option value="">{t("staff.site.customCategoryParentNone")}</option>
                  {CATALOG_CATEGORIES.map((key) => (
                    <option key={key} value={key}>
                      {t(`category.${key}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("staff.site.customCategoryLabelAr")}>
                <input
                  className="staff-input w-full"
                  value={cat.labelAr}
                  placeholder={t("staff.site.customCategoryLabelArPlaceholder")}
                  onChange={(e) =>
                    setDraft((d) => patchCustomCategory(d, cat.id, { labelAr: e.target.value }))
                  }
                />
              </Field>
              <Field label={t("staff.site.customCategoryLabelEn")}>
                <input
                  className="staff-input w-full"
                  dir="ltr"
                  style={{ textAlign: "left" }}
                  value={cat.labelEn}
                  placeholder="Women's rings"
                  onChange={(e) =>
                    setDraft((d) => patchCustomCategory(d, cat.id, { labelEn: e.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <StaffSingleImageField
                label={t("staff.site.categoryImage")}
                value={cat.image ?? ""}
                cloudUpload={cloudUpload}
                compact
                onChange={(image) => setDraft((d) => patchCustomCategory(d, cat.id, { image }))}
                onClear={() => setDraft((d) => patchCustomCategory(d, cat.id, { image: "" }))}
              />
              <label className="flex items-start gap-2 pt-6 text-sm">
                <input
                  type="checkbox"
                  checked={!!cat.showInHomeStrip}
                  onChange={(e) =>
                    setDraft((d) =>
                      patchCustomCategory(d, cat.id, { showInHomeStrip: e.target.checked }),
                    )
                  }
                />
                <span>{t("staff.site.customCategoryShowHome")}</span>
              </label>
            </div>
            {cat.slug.trim() && onAssignProduct && products.length > 0 && (
              <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--line)" }}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 text-[11px] uppercase tracking-eyebrow opacity-80 hover:opacity-100"
                  onClick={() => setExpandedAssign(assignOpen ? null : cat.id)}
                >
                  <span>{t("staff.site.customCategoryAssignProducts")}</span>
                  {assignOpen ? (
                    <ChevronUp className="h-4 w-4" strokeWidth={1.4} />
                  ) : (
                    <ChevronDown className="h-4 w-4" strokeWidth={1.4} />
                  )}
                </button>
                {assignOpen && (
                  <div className="mt-3">
                    <p className="mb-3 text-[11px] leading-relaxed opacity-60">
                      {t("staff.site.customCategoryAssignHint")}
                    </p>
                    <ul className="max-h-48 space-y-2 overflow-y-auto">
                      {products.map((p) => {
                        const checked = p.category === cat.slug;
                        const busy = assigningProductId === p.id;
                        return (
                          <li key={p.id}>
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!!assigningProductId}
                                onChange={(e) => void onAssignProduct(p.id, cat.slug, e.target.checked)}
                              />
                              <span className={busy ? "opacity-50" : ""}>{p.name || p.slug || p.id}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </li>
          );
        })}
      </ul>
      <button type="button" className="btn-ghost mt-5 inline-flex items-center gap-2" onClick={addCategory}>
        <Plus className="h-4 w-4" strokeWidth={1.4} />
        {t("staff.site.customCategoryAdd")}
      </button>
    </StaffSection>
  );
}

export function StaffAllImagesEditor({
  draft,
  setDraft,
  collectionsDraft,
  setCollectionsDraft,
  journal,
  setJournal,
  boutiques,
  setBoutiques,
  cloudUpload,
  confirmR2Ready,
}: {
  draft: SiteContent;
  setDraft: React.Dispatch<React.SetStateAction<SiteContent>>;
  collectionsDraft: Collection[];
  setCollectionsDraft: React.Dispatch<React.SetStateAction<Collection[]>>;
  journal: JournalArticle[];
  setJournal: (j: JournalArticle[]) => void;
  boutiques: Boutique[];
  setBoutiques: (b: Boutique[]) => void;
  cloudUpload: boolean;
  confirmR2Ready: () => void;
}) {
  const { t } = useLocale();
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const activeSlug = featuredCollectionSlug(draft);
  const activeCollection =
    featuredCollection(collectionsDraft, draft) ??
    collectionsDraft.find((c) => c.slug === activeSlug);

  const patchFeaturedCollection = (
    patch: Partial<Pick<Collection, "coverImage" | "editorialImage" | "name" | "tagline" | "description">>,
  ) => {
    if (!activeCollection) return;
    setCollectionsDraft((prev) => patchCollectionInList(prev, activeCollection.slug, patch));
  };

  const onVideoFile = async (files: FileList | null) => {
    setVideoError(null);
    const file = files?.[0];
    if (!file) return;
    const videoMime = staffVideoMimeFromFile(file);
    if (!isAllowedStaffVideoMime(videoMime)) {
      setVideoError(t("staff.hero.notVideo"));
      return;
    }
    if (file.size <= 0) {
      setVideoError(t("staff.images.uploadErr.empty_file"));
      return;
    }
    if (!cloudUpload) {
      setVideoError(t("staff.site.r2RequiredForVideo"));
      return;
    }
    try {
      setVideoBusy(true);
      const up = await uploadStaffMediaFile(file, "hero", { onSuccess: confirmR2Ready });
      if (up.ok) setDraft((d) => ({ ...d, heroVideo: up.url }));
      else setVideoError(translateStaffUploadError(up.code, t));
    } catch {
      setVideoError(t("staff.images.uploadErr.unknown"));
    } finally {
      setVideoBusy(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  return (
    <StaffSection title={t("staff.site.imagesHubTitle")} intro={t("staff.site.imagesHubIntro")}>
      <div className="flex min-w-0 flex-col gap-8">
        <StaffImageGroup title={t("staff.site.imagesHeroGroup")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <StaffSingleImageField
              label={t("staff.site.heroPoster")}
              value={draft.heroPoster ?? ""}
              cloudUpload={cloudUpload}
              onChange={(heroPoster) => setDraft((d) => ({ ...d, heroPoster }))}
              onClear={() => setDraft((d) => ({ ...d, heroPoster: "" }))}
            />
            <div className="min-w-0">
              <Field label={t("staff.hero.url")}>
                <input
                  className="staff-input w-full"
                  dir="ltr"
                  style={{ textAlign: "left" }}
                  value={draft.heroVideo ?? ""}
                  placeholder={t("staff.site.heroUrlPlaceholder")}
                  onChange={(e) => setDraft((d) => ({ ...d, heroVideo: e.target.value }))}
                />
              </Field>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  disabled={videoBusy}
                  onChange={(e) => void onVideoFile(e.target.files)}
                />
                <button
                  type="button"
                  disabled={videoBusy}
                  className="btn-ghost shrink-0 text-[10px] sm:text-[11px]"
                  onClick={() => videoInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 shrink-0" strokeWidth={1.4} />
                  <span>{t("staff.hero.upload")}</span>
                </button>
                <button
                  type="button"
                  className="btn-ghost shrink-0 text-[10px] sm:text-[11px]"
                  onClick={() => setDraft((d) => ({ ...d, heroVideo: "" }))}
                >
                  <RotateCcw className="h-4 w-4 shrink-0" strokeWidth={1.4} />
                  <span>{t("staff.hero.reset")}</span>
                </button>
              </div>
              {videoError && (
                <p className="mt-2 text-xs" style={{ color: "var(--color-bordeaux)" }}>
                  {videoError}
                </p>
              )}
            </div>
          </div>
        </StaffImageGroup>

        <StaffImageGroup title={t("staff.site.imagesHomeStripGroup")}>
          <ul className="grid min-w-0 gap-4 sm:grid-cols-2">
            {HOME_CATEGORY_STRIP.map((key) => (
              <StaffCategoryImageTile
                key={key}
                categoryKey={key}
                draft={draft}
                setDraft={setDraft}
                cloudUpload={cloudUpload}
              />
            ))}
          </ul>
        </StaffImageGroup>

        <StaffImageGroup title={t("staff.site.imagesLandingGroup")} hint={t("staff.site.imagesLandingHint")}>
          <ul className="grid min-w-0 gap-4 lg:grid-cols-2">
            {CATEGORY_LANDING_PAGES.map((key) => (
              <StaffCategoryImageTile
                key={key}
                categoryKey={key}
                draft={draft}
                setDraft={setDraft}
                cloudUpload={cloudUpload}
                extra={
                  key === "bridal" ? (
                    <StaffSingleImageField
                      label={t("staff.site.bridalEditorialImage")}
                      value={draft.categories?.bridal?.secondaryImage ?? ""}
                      cloudUpload={cloudUpload}
                      compact
                      onChange={(secondaryImage) =>
                        setDraft((d) => patchCategory(d, "bridal", { secondaryImage }))
                      }
                      onClear={() => setDraft((d) => patchCategory(d, "bridal", { secondaryImage: "" }))}
                    />
                  ) : undefined
                }
              />
            ))}
          </ul>
        </StaffImageGroup>

        <StaffImageGroup title={t("staff.site.imagesMaisonGroup")}>
          <div className="max-w-xl">
            <StaffSingleImageField
              label={t("staff.site.atelierImage")}
              value={draft.homepage?.atelierImage ?? ""}
              cloudUpload={cloudUpload}
              onChange={(atelierImage) =>
                setDraft((d) => ({ ...d, homepage: { ...d.homepage, atelierImage } }))
              }
              onClear={() => setDraft((d) => ({ ...d, homepage: { ...d.homepage, atelierImage: "" } }))}
            />
          </div>
        </StaffImageGroup>

        <StaffImageGroup
          title={t("staff.site.imagesFeaturedGroup")}
          hint={t("staff.site.imagesFeaturedHint")}
          defaultOpen={false}
        >
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Field label={t("staff.site.featuredCollection")}>
              <select
                className="staff-input w-full"
                value={draft.homepage?.featuredCollectionSlug ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    homepage: { ...d.homepage, featuredCollectionSlug: e.target.value },
                  }))
                }
              >
                <option value="">{t("staff.site.featuredCollectionAuto")}</option>
                {collectionsDraft.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            {activeCollection && (
              <div className="sm:col-span-2 grid gap-4 rounded-sm p-4 sm:grid-cols-2" style={{ border: "1px solid var(--line)" }}>
                <p className="sm:col-span-2 font-display text-lg">{activeCollection.name}</p>
                <StaffSingleImageField
                  label={t("staff.site.featuredEditorialImage")}
                  value={activeCollection.editorialImage}
                  cloudUpload={cloudUpload}
                  uploadScope="collections"
                  onChange={(editorialImage) => patchFeaturedCollection({ editorialImage })}
                  onClear={() => patchFeaturedCollection({ editorialImage: "" })}
                />
                <StaffSingleImageField
                  label={t("staff.collections.fieldCover")}
                  value={activeCollection.coverImage}
                  cloudUpload={cloudUpload}
                  uploadScope="collections"
                  onChange={(coverImage) => patchFeaturedCollection({ coverImage })}
                  onClear={() => patchFeaturedCollection({ coverImage: "" })}
                />
                <Field label={t("staff.collections.fieldTagline")}>
                  <input
                    className="staff-input w-full"
                    value={activeCollection.tagline}
                    onChange={(e) => patchFeaturedCollection({ tagline: e.target.value })}
                  />
                </Field>
                <Field label={t("staff.collections.fieldDescription")}>
                  <textarea
                    className="staff-input w-full"
                    rows={3}
                    value={activeCollection.description}
                    onChange={(e) => patchFeaturedCollection({ description: e.target.value })}
                  />
                </Field>
              </div>
            )}
          </div>
        </StaffImageGroup>

        <StaffImageGroup title={t("staff.site.imagesCollectionsGroup")} defaultOpen={false}>
          <ul className="grid min-w-0 gap-4">
            {collectionsDraft.map((c) => (
              <li
                key={c.id}
                className="grid gap-4 rounded-sm p-4 sm:grid-cols-2"
                style={{ border: "1px solid var(--line)", background: "var(--surface)" }}
              >
                <p className="sm:col-span-2 font-display text-lg">
                  {c.name}
                  <span className="ms-2 text-sm opacity-60">/{c.slug}</span>
                </p>
                <StaffSingleImageField
                  label={t("staff.collections.fieldCover")}
                  value={c.coverImage}
                  cloudUpload={cloudUpload}
                  uploadScope="collections"
                  onChange={(coverImage) =>
                    setCollectionsDraft((prev) => patchCollectionInList(prev, c.slug, { coverImage }))
                  }
                  onClear={() =>
                    setCollectionsDraft((prev) => patchCollectionInList(prev, c.slug, { coverImage: "" }))
                  }
                />
                <StaffSingleImageField
                  label={t("staff.collections.fieldEditorial")}
                  value={c.editorialImage}
                  cloudUpload={cloudUpload}
                  uploadScope="collections"
                  onChange={(editorialImage) =>
                    setCollectionsDraft((prev) => patchCollectionInList(prev, c.slug, { editorialImage }))
                  }
                  onClear={() =>
                    setCollectionsDraft((prev) => patchCollectionInList(prev, c.slug, { editorialImage: "" }))
                  }
                />
              </li>
            ))}
          </ul>
        </StaffImageGroup>

        {boutiques.length > 0 && (
          <StaffImageGroup title={t("staff.site.imagesBoutiquesGroup")} defaultOpen={false}>
            <ul className="grid min-w-0 gap-4 sm:grid-cols-2">
              {boutiques.map((b) => (
                <li
                  key={b.id}
                  className="rounded-sm p-4"
                  style={{ border: "1px solid var(--line)", background: "var(--surface)" }}
                >
                  <p className="font-display text-base">{b.city}</p>
                  <div className="mt-3">
                    <StaffSingleImageField
                      label={t("staff.boutiques.fieldImage")}
                      value={b.image}
                      cloudUpload={cloudUpload}
                      uploadScope="site"
                      onChange={(image) =>
                        setBoutiques(boutiques.map((x) => (x.id === b.id ? { ...x, image } : x)))
                      }
                      onClear={() =>
                        setBoutiques(boutiques.map((x) => (x.id === b.id ? { ...x, image: "" } : x)))
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
          </StaffImageGroup>
        )}

        {journal.length > 0 && (
          <StaffImageGroup
            title={t("staff.site.imagesJournalGroup")}
            hint={t("staff.site.imagesJournalHint")}
            defaultOpen={false}
          >
            <ul className="grid min-w-0 gap-4 sm:grid-cols-2">
              {journal.map((a) => (
                <li
                  key={a.id}
                  className="rounded-sm p-4"
                  style={{ border: "1px solid var(--line)", background: "var(--surface)" }}
                >
                  <p className="font-display text-lg">{a.title}</p>
                  <div className="mt-3 max-w-md">
                    <StaffSingleImageField
                      label={t("staff.journal.fieldImage")}
                      value={a.image}
                      cloudUpload={cloudUpload}
                      mediaKind="journal"
                      onChange={(image) =>
                        setJournal(journal.map((x) => (x.id === a.id ? { ...x, image } : x)))
                      }
                      onClear={() => setJournal(journal.map((x) => (x.id === a.id ? { ...x, image: "" } : x)))}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </StaffImageGroup>
        )}
      </div>
    </StaffSection>
  );
}

export function StaffHomepageEditor({
  draft,
  setDraft,
  products,
  cloudUpload: _cloudUpload,
}: {
  draft: SiteContent;
  setDraft: React.Dispatch<React.SetStateAction<SiteContent>>;
  products: Product[];
  collections?: Collection[];
  cloudUpload: boolean;
}) {
  const { t } = useLocale();
  const featuredIds = draft.homepage?.featuredProductIds ?? [];
  const [pickId, setPickId] = useState("");

  const moveFeatured = (index: number, dir: -1 | 1) => {
    const next = featuredIds.slice();
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    const tmp = next[index];
    next[index] = next[j];
    next[j] = tmp;
    setDraft((d) => ({
      ...d,
      homepage: { ...d.homepage, featuredProductIds: next },
    }));
  };

  const addFeatured = () => {
    if (!pickId || featuredIds.includes(pickId)) return;
    setDraft((d) => ({
      ...d,
      homepage: {
        ...d.homepage,
        featuredProductIds: [...(d.homepage?.featuredProductIds ?? []), pickId],
      },
    }));
    setPickId("");
  };

  const removeFeatured = (id: string) => {
    setDraft((d) => ({
      ...d,
      homepage: {
        ...d.homepage,
        featuredProductIds: (d.homepage?.featuredProductIds ?? []).filter((x) => x !== id),
      },
    }));
  };

  const available = products.filter((p) => !featuredIds.includes(p.id));

  return (
    <StaffSection title={t("staff.site.homeTitle")} intro={t("staff.site.homeProductsIntro")}>
      <div className="min-w-0 max-w-2xl">
          <p className="staff-label">{t("staff.site.featuredProducts")}</p>
          <p className="mt-1 text-xs leading-relaxed opacity-65">{t("staff.site.featuredProductsHint")}</p>
          <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch">
            <select
              className="staff-input min-w-0 flex-1"
              value={pickId}
              onChange={(e) => setPickId(e.target.value)}
            >
              <option value="">{t("staff.site.pickProduct")}</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn-primary shrink-0 sm:px-6" disabled={!pickId} onClick={addFeatured}>
              {t("staff.site.addFeatured")}
            </button>
          </div>
          {featuredIds.length === 0 ? (
            <p className="mt-4 text-sm opacity-60">{t("staff.site.featuredProductsEmpty")}</p>
          ) : (
            <ul className="mt-4 grid max-h-[min(420px,50vh)] gap-2 overflow-y-auto overscroll-contain pe-1">
              {featuredIds.map((id, index) => {
                const p = products.find((x) => x.id === id);
                if (!p) return null;
                return (
                  <li
                    key={id}
                    className="flex min-w-0 items-center gap-3 p-2.5"
                    style={{ border: "1px solid var(--line)", background: "var(--background)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={productImageAt(p, 0)}
                      alt=""
                      className="h-12 w-12 shrink-0 object-cover sm:h-14 sm:w-14"
                      style={{ background: "var(--surface-2)" }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        className="btn-ghost p-1.5"
                        aria-label="Up"
                        disabled={index === 0}
                        onClick={() => moveFeatured(index, -1)}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost p-1.5"
                        aria-label="Down"
                        disabled={index === featuredIds.length - 1}
                        onClick={() => moveFeatured(index, 1)}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost p-1.5"
                        aria-label={t("staff.images.remove")}
                        onClick={() => removeFeatured(id)}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
      </div>
    </StaffSection>
  );
}

export function StaffCommerceSettingsEditor({
  draft,
  setDraft,
  products,
}: {
  draft: SiteContent;
  setDraft: React.Dispatch<React.SetStateAction<SiteContent>>;
  products: Product[];
}) {
  const { t } = useLocale();
  const codes = draft.discountCodes ?? [];

  const updateCodes = (next: typeof codes) => {
    setDraft((d) => ({ ...d, discountCodes: next }));
  };

  const addCode = () => {
    const id = `dc-${Date.now()}`;
    updateCodes([
      ...codes,
      {
        id,
        code: "",
        percentOff: 10,
        appliesTo: "all",
        active: true,
      },
    ]);
  };

  const patchCode = (id: string, patch: Partial<(typeof codes)[number]>) => {
    updateCodes(codes.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const removeCode = (id: string) => {
    updateCodes(codes.filter((c) => c.id !== id));
  };

  const toggleProduct = (id: string, productId: string) => {
    const row = codes.find((c) => c.id === id);
    if (!row) return;
    const set = new Set(row.productIds ?? []);
    if (set.has(productId)) set.delete(productId);
    else set.add(productId);
    patchCode(id, { productIds: [...set] });
  };

  return (
    <>
      <div className="staff-card grid min-w-0 gap-4 p-5 sm:p-6">
        <p className="eyebrow text-[10px]">{t("staff.site.commerceTitle")}</p>
        <p className="text-sm opacity-70">{t("staff.site.shippingHint")}</p>
        <div className="max-w-xs">
          <Field label={t("staff.site.shippingFeeLabel")}>
            <input
              type="number"
              className="staff-input w-full"
              min={0}
              max={500000}
              step={500}
              value={draft.shippingFeeIqd ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                setDraft({
                  ...draft,
                  shippingFeeIqd: v === "" ? undefined : Math.round(Number(v)),
                });
              }}
            />
          </Field>
        </div>
      </div>

      <StaffSection title={t("staff.site.discountCodesTitle")} intro={t("staff.site.discountCodesIntro")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs opacity-65">{t("staff.site.discountCodesCount").replace("{n}", String(codes.length))}</p>
          <button type="button" className="btn-ghost text-[11px]" onClick={addCode}>
            <Plus className="me-1 inline h-3.5 w-3.5" aria-hidden />
            {t("staff.site.discountCodeAdd")}
          </button>
        </div>
        {codes.length === 0 ? (
          <p className="mt-4 text-sm opacity-65">{t("staff.site.discountCodesEmpty")}</p>
        ) : (
          <ul className="mt-6 grid min-w-0 gap-6">
            {codes.map((row) => (
              <li
                key={row.id}
                className="grid min-w-0 gap-4 border p-4 sm:p-5"
                style={{ borderColor: "var(--line)" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="font-display text-lg">{row.code || t("staff.site.discountCodeNew")}</p>
                  <button
                    type="button"
                    className="btn-ghost text-[10px]"
                    onClick={() => removeCode(row.id)}
                    aria-label={t("staff.site.discountCodeRemove")}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label={t("staff.site.discountCodeField")}>
                    <input
                      className="staff-input w-full uppercase"
                      value={row.code}
                      onChange={(e) =>
                        patchCode(row.id, { code: e.target.value.toUpperCase().replace(/\s+/g, "") })
                      }
                      placeholder="SUMMER20"
                    />
                  </Field>
                  <Field label={t("staff.site.discountPercentLabel")}>
                    <input
                      type="number"
                      className="staff-input w-full"
                      min={1}
                      max={100}
                      value={row.percentOff}
                      onChange={(e) =>
                        patchCode(row.id, {
                          percentOff: Math.min(100, Math.max(1, Math.round(Number(e.target.value) || 0))),
                        })
                      }
                    />
                  </Field>
                  <Field label={t("staff.site.discountExpiresLabel")}>
                    <input
                      type="date"
                      className="staff-input w-full"
                      value={row.expiresAt?.slice(0, 10) ?? ""}
                      onChange={(e) =>
                        patchCode(row.id, {
                          expiresAt: e.target.value ? `${e.target.value}T23:59:59.999Z` : undefined,
                        })
                      }
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={row.active}
                      onChange={(e) => patchCode(row.id, { active: e.target.checked })}
                    />
                    {t("staff.site.discountActive")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="staff-tab text-[11px]"
                      data-active={row.appliesTo === "all"}
                      onClick={() => patchCode(row.id, { appliesTo: "all", productIds: undefined })}
                    >
                      {t("staff.site.discountAppliesAll")}
                    </button>
                    <button
                      type="button"
                      className="staff-tab text-[11px]"
                      data-active={row.appliesTo === "products"}
                      onClick={() =>
                        patchCode(row.id, {
                          appliesTo: "products",
                          productIds: row.productIds ?? [],
                        })
                      }
                    >
                      {t("staff.site.discountAppliesProducts")}
                    </button>
                  </div>
                </div>
                {row.appliesTo === "products" && (
                  <div className="max-h-48 overflow-y-auto border p-3" style={{ borderColor: "var(--line)" }}>
                    <p className="mb-3 text-[11px] opacity-65">{t("staff.site.discountProductsHint")}</p>
                    <ul className="grid gap-2">
                      {products.map((p) => {
                        const checked = row.productIds?.includes(p.id) ?? false;
                        return (
                          <li key={p.id}>
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleProduct(row.id, p.id)}
                              />
                              <span className="min-w-0 truncate">{p.name}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </StaffSection>
    </>
  );
}

export function StaffSiteTextsEditor({
  draft,
  setDraft,
}: {
  draft: SiteContent;
  setDraft: React.Dispatch<React.SetStateAction<SiteContent>>;
}) {
  const { t } = useLocale();
  const [localeTab, setLocaleTab] = useState<"en" | "ar">("ar");

  const readKey = (key: SiteCopyKey) => {
    const bundle = localeTab === "ar" ? draft.copyAr : draft.copyEn;
    return bundle?.[key] ?? "";
  };

  const writeKey = (key: SiteCopyKey, value: string) => {
    setDraft((d) => patchSiteCopyBundle(d, localeTab, key, value));
  };

  return (
    <StaffSection title={t("staff.copy.title")} intro={t("staff.copy.intro")}>
      <div className="flex flex-wrap gap-2 border-b pb-4" style={{ borderColor: "var(--line)" }}>
        <button
          type="button"
          className="staff-tab"
          data-active={localeTab === "ar"}
          onClick={() => setLocaleTab("ar")}
        >
          {t("staff.copy.tabAr")}
        </button>
        <button
          type="button"
          className="staff-tab"
          data-active={localeTab === "en"}
          onClick={() => setLocaleTab("en")}
        >
          {t("staff.copy.tabEn")}
        </button>
      </div>
      <p className="mt-4 text-xs leading-relaxed opacity-65">{t("staff.copy.hint")}</p>
      <div className="mt-6 grid min-w-0 gap-8">
        {SITE_COPY_GROUPS.map((group) => (
          <div key={group.id}>
            <p className="eyebrow text-[10px]">{t(group.labelKey)}</p>
            <ul className="mt-4 grid min-w-0 gap-4">
              {group.keys.map((key) => (
                <li key={key}>
                  <Field label={t(key)}>
                    <input
                      className="staff-input w-full"
                      value={readKey(key)}
                      placeholder={t(key)}
                      onChange={(e) => writeKey(key, e.target.value)}
                    />
                  </Field>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </StaffSection>
  );
}

export function StaffBoutiquesEditor({
  boutiques,
  setBoutiques,
  cloudUpload,
}: {
  boutiques: Boutique[];
  setBoutiques: (b: Boutique[]) => void;
  cloudUpload: boolean;
}) {
  const { t } = useLocale();

  const patchBoutique = (id: string, patch: Partial<Boutique>) => {
    setBoutiques(boutiques.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const onAdd = () => {
    const id = "b-" + Date.now();
    setBoutiques([
      ...boutiques,
      {
        id,
        city: t("staff.boutiques.newCity"),
        country: t("staff.boutiques.newCountry"),
        address: "",
        phone: "",
        hours: "",
        image: "",
      },
    ]);
  };

  const onDelete = (id: string) => {
    if (typeof window !== "undefined" && !window.confirm(t("staff.boutiques.deleteConfirm"))) return;
    setBoutiques(boutiques.filter((x) => x.id !== id));
  };

  return (
    <section className="min-w-0 pb-8">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display break-words text-2xl sm:text-3xl">
            {t("staff.boutiques.titleCount").replace("{n}", String(boutiques.length))}
          </h2>
          <p className="mt-2 text-sm opacity-70">{t("staff.boutiques.hint")}</p>
        </div>
        <button type="button" onClick={onAdd} className="btn-ghost shrink-0 self-start">
          <Plus className="h-4 w-4" strokeWidth={1.4} /> {t("staff.boutiques.add")}
        </button>
      </header>
      <div className="grid min-w-0 gap-4">
        {boutiques.map((b) => (
          <details key={b.id} className="staff-card min-w-0 p-4 sm:p-5">
            <summary className="cursor-pointer font-display text-xl">{b.city}</summary>
            <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
              <Field label={t("staff.boutiques.fieldCity")}>
                <input className="staff-input w-full" value={b.city} onChange={(e) => patchBoutique(b.id, { city: e.target.value })} />
              </Field>
              <Field label={t("staff.boutiques.fieldCountry")}>
                <input className="staff-input w-full" value={b.country} onChange={(e) => patchBoutique(b.id, { country: e.target.value })} />
              </Field>
              <Field label={t("staff.boutiques.fieldAddress")}>
                <input className="staff-input w-full" value={b.address} onChange={(e) => patchBoutique(b.id, { address: e.target.value })} />
              </Field>
              <Field label={t("staff.boutiques.fieldPhone")}>
                <input className="staff-input w-full" dir="ltr" style={{ textAlign: "left" }} value={b.phone} onChange={(e) => patchBoutique(b.id, { phone: e.target.value })} />
              </Field>
              <div className="sm:col-span-2">
                <Field label={t("staff.boutiques.fieldHours")}>
                  <input className="staff-input w-full" value={b.hours} onChange={(e) => patchBoutique(b.id, { hours: e.target.value })} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <StaffSingleImageField
                  label={t("staff.boutiques.fieldImage")}
                  value={b.image}
                  cloudUpload={cloudUpload}
                  uploadScope="site"
                  onChange={(image) => patchBoutique(b.id, { image })}
                  onClear={() => patchBoutique(b.id, { image: "" })}
                />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <button type="button" className="btn-ghost" onClick={() => onDelete(b.id)}>
                  <Trash2 className="h-4 w-4" strokeWidth={1.4} /> {t("staff.boutiques.delete")}
                </button>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
