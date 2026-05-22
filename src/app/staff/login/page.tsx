"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SectionTitle } from "@/components/Section";
import { useAuth, type StaffSessionError } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";

function staffLoginErrorMessage(code: StaffSessionError | false, t: (key: string) => string): string {
  if (code === false) return t("staff.login.error");
  const key = `staff.login.err.${code}`;
  const msg = t(key);
  return msg === key ? t("staff.login.error") : msg;
}

export default function StaffLoginPage() {
  const { signIn, signedInAs, hydrated } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hydrated && signedInAs.staff) router.replace("/staff");
  }, [hydrated, signedInAs.staff, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn("staff", username, password);
    setLoading(false);
    if (result === true) {
      router.push("/staff");
      return;
    }
    setError(staffLoginErrorMessage(result === false ? false : result, t));
  };

  if (hydrated && signedInAs.staff) {
    return <div className="px-6 py-32 text-center opacity-70">…</div>;
  }

  return (
    <div className="min-w-0 overflow-x-hidden px-4 py-16 sm:px-5 md:px-10 md:py-28 [padding-bottom:max(2.5rem,env(safe-area-inset-bottom,0px))]">
      <SectionTitle eyebrow="MUHRA" title={t("staff.signin")} />
      <form onSubmit={onSubmit} className="card-luxe mx-auto mt-8 w-full max-w-md p-6 sm:mt-12 sm:p-10">
        <label className="field-label" htmlFor="u">
          {t("staff.login.username")}
        </label>
        <input
          id="u"
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="input-luxe"
          autoComplete="username"
          required
        />
        <label className="field-label mt-6" htmlFor="p">
          {t("common.password")}
        </label>
        <input
          id="p"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-luxe"
          autoComplete="current-password"
          required
        />
        {error && (
          <p className="mt-4 text-sm" style={{ color: "var(--color-bordeaux)" }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={loading} className="btn-primary mt-8 w-full">
          {loading ? "…" : t("common.signin")}
        </button>
      </form>
    </div>
  );
}
