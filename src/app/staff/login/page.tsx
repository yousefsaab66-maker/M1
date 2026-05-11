"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SectionTitle } from "@/components/Section";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";

export default function StaffLoginPage() {
  const { signIn, signedInAs } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const ok = await signIn("staff", username, password);
    setLoading(false);
    if (ok) router.push("/staff");
    else setError(t("staff.login.error"));
  };

  if (signedInAs.staff) {
    if (typeof window !== "undefined") {
      router.replace("/staff");
    }
    return null;
  }

  return (
    <div className="min-w-0 overflow-x-hidden px-4 py-16 sm:px-5 md:px-10 md:py-28 [padding-bottom:max(2.5rem,env(safe-area-inset-bottom,0px))]">
      <SectionTitle eyebrow="MUHRA" title={t("staff.signin")} />
      <form onSubmit={onSubmit} className="card-luxe mx-auto mt-8 w-full max-w-md p-6 sm:mt-12 sm:p-10">
        <label className="field-label" htmlFor="u">{t("staff.login.username")}</label>
        <input id="u" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} className="input-luxe" autoComplete="username" required />
        <label className="field-label mt-6" htmlFor="p">{t("common.password")}</label>
        <input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-luxe" autoComplete="current-password" required />
        {error && <p className="mt-4 text-sm" style={{ color: "var(--color-bordeaux)" }}>{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary mt-8 w-full">
          {loading ? "…" : t("common.signin")}
        </button>
      </form>
    </div>
  );
}
