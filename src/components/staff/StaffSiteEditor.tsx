"use client";

import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, RotateCcw, Upload, X } from "lucide-react";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { Category, Collection, Product, SiteContent } from "@/lib/catalog";
import { CATALOG_CATEGORIES, HOME_CATEGORY_STRIP } from "@/lib/site-display";
import { MUHRA_MAX_IMAGE_UPLOAD_BYTES } from "@/lib/supabase/storage-constants";
import { productImageAt } from "@/lib/product-media";

function translateUploadErr(code: string, t: (key: string) => string): string {
  const key = `staff.images.uploadErr.${code}`;
  const txt = t(key);
  return txt === key ? t("staff.images.uploadErr.unknown") : txt;
}

async function uploadStaffImage(file: File): Promise<{ ok: true; url: string } | { ok: false; code: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/staff/upload", { method: "POST", body: fd, credentials: "same-origin" });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
  if (res.ok && body.ok && typeof body.url === "string") return { ok: true, url: body.url };
  const code = typeof body.error === "string" && body.error.length > 0 ? body.error : "unknown";
  return { ok: false, code };
}

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
  onClear,
  compact,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  cloudUpload: boolean;
  onClear?: () => void;
  compact?: boolean;
}) {
  const { t } = useLocale();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError(t("staff.images.notImage").replace("{name}", file.name));
      return;
    }
    if (file.size > MUHRA_MAX_IMAGE_UPLOAD_BYTES) {
      setError(t("staff.images.tooLarge").replace("{name}", file.name));
      return;
    }
    if (!cloudUpload) {
      setError(t("staff.site.r2RequiredForImages"));
      return;
    }
    setBusy(true);
    try {
      const up = await uploadStaffImage(file);
      if (up.ok) onChange(up.url);
      else setError(translateUploadErr(up.code, t));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
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
          value={value}
          placeholder="https://…"
          onChange={(e) => onChange(e.target.value)}
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
          disabled={busy || !cloudUpload}
          className="btn-ghost shrink-0 text-[10px] sm:text-[11px]"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4 shrink-0" strokeWidth={1.4} />
          <span className="truncate">{busy ? t("staff.images.uploading") : t("staff.images.upload")}</span>
        </button>
        {onClear && (
          <button type="button" className="btn-ghost shrink-0 text-[10px] sm:text-[11px]" onClick={onClear}>
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

function patchCategory(draft: SiteContent, key: Category, patch: { label?: string; image?: string }): SiteContent {
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
    <section className="staff-card mt-8 min-w-0 overflow-hidden p-5 sm:p-6">
      <header className="border-b pb-4" style={{ borderColor: "var(--line)" }}>
        <h3 className="font-display text-xl sm:text-2xl">{title}</h3>
        {intro && <p className="mt-2 max-w-2xl text-sm leading-relaxed opacity-70">{intro}</p>}
      </header>
      <div className="mt-6 min-w-0">{children}</div>
    </section>
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
      <ul className="grid min-w-0 gap-5 sm:grid-cols-2">
        {CATALOG_CATEGORIES.map((key) => {
          const entry = draft.categories?.[key] ?? {};
          const systemLabel = t(`category.${key}`);
          const onHome = HOME_CATEGORY_STRIP.includes(key);
          return (
            <li
              key={key}
              className="min-w-0 rounded-sm p-4"
              style={{ border: "1px solid var(--line)", background: "var(--surface)" }}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="eyebrow text-[9px] sm:text-[10px]">{systemLabel}</span>
                {onHome && (
                  <span
                    className="text-[9px] tracking-eyebrow uppercase opacity-60"
                    style={{ color: "var(--color-gold-deep)" }}
                  >
                    {t("staff.site.onHomepage")}
                  </span>
                )}
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
                <StaffSingleImageField
                  label={t("staff.site.categoryImage")}
                  value={entry.image ?? ""}
                  cloudUpload={cloudUpload}
                  compact
                  onChange={(image) => setDraft((d) => patchCategory(d, key, { image }))}
                  onClear={() => setDraft((d) => patchCategory(d, key, { image: "" }))}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </StaffSection>
  );
}

export function StaffHomepageEditor({
  draft,
  setDraft,
  products,
  collections,
  cloudUpload,
}: {
  draft: SiteContent;
  setDraft: React.Dispatch<React.SetStateAction<SiteContent>>;
  products: Product[];
  collections: Collection[];
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
    <StaffSection title={t("staff.site.homeTitle")} intro={t("staff.site.homeIntro")}>
      <div className="grid min-w-0 gap-8 lg:grid-cols-2 lg:gap-10">
        <div className="min-w-0 grid gap-6">
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
              {collections.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <StaffSingleImageField
            label={t("staff.site.atelierImage")}
            value={draft.homepage?.atelierImage ?? ""}
            cloudUpload={cloudUpload}
            onChange={(atelierImage) => setDraft((d) => ({ ...d, homepage: { ...d.homepage, atelierImage } }))}
            onClear={() => setDraft((d) => ({ ...d, homepage: { ...d.homepage, atelierImage: "" } }))}
          />
        </div>

        <div className="min-w-0">
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
      </div>
    </StaffSection>
  );
}
