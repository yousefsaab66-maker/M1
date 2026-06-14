"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { SectionTitle } from "@/components/Section";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useStore } from "@/components/providers/StoreProvider";
import { catalogFilterSlugs, productCategoryLabel } from "@/lib/site-display";
import { prefetchCatalogProductsApi } from "@/lib/catalog-prefetch-client";

type Sort = "featured" | "priceAsc" | "priceDesc" | "new";

export function ProductsCatalog() {
  const { t, locale } = useLocale();
  const { products, site } = useStore();
  const sp = useSearchParams();
  const filterSlugs = useMemo(() => catalogFilterSlugs(site), [site]);

  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("featured");

  useEffect(() => {
    prefetchCatalogProductsApi();
  }, []);

  useEffect(() => {
    const cat = sp.get("category")?.trim() ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cat && filterSlugs.includes(cat)) setCategory(cat);
  }, [sp, filterSlugs]);

  const filtered = useMemo(() => {
    let list = products.slice();
    if (category) list = list.filter((p) => p.category === category);
    if (sort === "priceAsc") list.sort((a, b) => a.price - b.price);
    else if (sort === "priceDesc") list.sort((a, b) => b.price - a.price);
    else if (sort === "new") list.sort((a, b) => Number(!!b.isNew) - Number(!!a.isNew));
    return list;
  }, [products, category, sort]);

  return (
    <div>
      <section className="page-gutter py-20 md:py-28">
        <SectionTitle eyebrow={t("nav.collections")} title={t("products.heading")} />
      </section>
      <section className="page-gutter">
        <div className="mx-auto max-w-[1400px]">
          <div
            className="flex flex-wrap items-end justify-between gap-6 pb-8"
            style={{ borderBottom: "1px solid var(--line)" }}
          >
            <div className="flex flex-wrap items-center gap-3">
              <p className="eyebrow me-2">{t("filter.category")}</p>
              <button
                type="button"
                onClick={() => setCategory(null)}
                className={`chip ${category === null ? "chip-active" : ""}`}
              >
                {t("filter.sort.featured")}
              </button>
              {filterSlugs.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`chip ${category === c ? "chip-active" : ""}`}
                >
                  {productCategoryLabel(c, site, t, locale)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label className="eyebrow opacity-80" htmlFor="sort">
                {t("filter.sort")}
              </label>
              <select
                id="sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="bg-transparent text-[12px] tracking-eyebrow uppercase outline-none"
                style={{ borderBottom: "1px solid var(--line-strong)", padding: "4px 8px" }}
              >
                <option value="featured">{t("filter.sort.featured")}</option>
                <option value="priceAsc">{t("filter.sort.priceAsc")}</option>
                <option value="priceDesc">{t("filter.sort.priceDesc")}</option>
                <option value="new">{t("filter.sort.new")}</option>
              </select>
            </div>
          </div>

          <p className="py-6 text-[11px] tracking-eyebrow uppercase opacity-65">
            {filtered.length} {t("filter.results")}
          </p>

          <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-14 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-8">
            {filtered.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="my-20 text-center opacity-70">{t("products.empty")}</p>
          )}
        </div>
      </section>

      <style jsx global>{`
        .chip {
          display: inline-flex;
          align-items: center;
          padding: 0.45rem 0.95rem;
          font-size: 0.66rem;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          border: 1px solid var(--line-strong);
          background: transparent;
          transition:
            background 0.4s var(--ease-luxe),
            border-color 0.4s var(--ease-luxe),
            color 0.4s var(--ease-luxe);
        }
        .chip:hover {
          border-color: var(--color-gold);
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
      `}</style>
    </div>
  );
}
