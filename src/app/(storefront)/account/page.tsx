"use client";

import { useState } from "react";
import Link from "next/link";
import { SectionTitle } from "@/components/Section";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useStore } from "@/components/providers/StoreProvider";

export default function AccountPage() {
  const { user, signIn, signOut, orders, hydrated } = useStore();
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  return (
    <div className="page-gutter py-20 md:py-28">
      <SectionTitle eyebrow={t("nav.account")} title={t("account.title")} subtitle={t("account.intro")} />
      <div className="mx-auto mt-16 max-w-md">
        {!hydrated ? (
          <p className="text-center opacity-60">…</p>
        ) : user ? (
          <div className="card-luxe p-10 text-center">
            <p className="eyebrow">{t("nav.account")}</p>
            <h3 className="font-display mt-4 text-3xl">{user.name}</h3>
            {user.email && <p className="mt-1 text-sm opacity-70">{user.email}</p>}
            <p className="mt-6 text-sm opacity-70">
              {t("account.ordersOnRecord").replace("{n}", String(orders.length))}
            </p>
            <button type="button" onClick={signOut} className="btn-ghost mt-8">
              {t("common.signout")}
            </button>
            <div className="mt-6">
              <Link href={"/wishlist" as never} className="text-[11px] tracking-eyebrow uppercase gold-underline">
                {t("nav.wishlist")} →
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              signIn(name, email);
            }}
            className="card-luxe p-10"
          >
            <label className="field-label" htmlFor="name">{t("common.name")}</label>
            <input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="input-luxe" autoComplete="name" />
            <label className="field-label mt-6" htmlFor="email">{t("common.email")}</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-luxe" autoComplete="email" />
            <button type="submit" className="btn-primary mt-8 w-full">
              {t("common.signin")}
            </button>
            <p className="mt-5 text-xs opacity-60 text-center">
              {t("account.demoNote")}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
