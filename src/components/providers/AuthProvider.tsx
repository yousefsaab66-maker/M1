"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { hashCredential } from "@/lib/hash";

export type Role = "staff" | "admin";

const KEY_HASH = (role: Role) => `muhra-${role}-hash-v1`;
const KEY_USER = (role: Role) => `muhra-${role}-user-v1`;
const KEY_SESSION = (role: Role) => `muhra-${role}-session-v1`;

const DEFAULT_CREDS: Record<Role, { username: string; password: string }> = {
  staff: { username: "staff", password: "staff12345678" },
  admin: { username: "admin", password: "admin123" },
};

async function establishStaffHttpSession(username: string, password: string): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch("/api/staff/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
  } catch {
    return false;
  }
  if (!res.ok) return false;
  try {
    const body = (await res.json()) as { ok?: boolean };
    return body.ok === true;
  } catch {
    return false;
  }
}

type AuthCtx = {
  authedRole: Role | null;
  signedInAs: { staff: string | null; admin: string | null };
  signIn: (role: Role, username: string, password: string) => Promise<boolean>;
  signOut: (role: Role) => void;
  changeCredentials: (
    role: Role,
    currentPassword: string,
    newUsername: string,
    newPassword: string,
  ) => Promise<boolean>;
  hydrated: boolean;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [staffSession, setStaffSession] = useState<string | null>(null);
  const [adminSession, setAdminSession] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      for (const role of ["staff", "admin"] as Role[]) {
        try {
          const existing = localStorage.getItem(KEY_HASH(role));
          if (!existing) {
            const def = DEFAULT_CREDS[role];
            const h = await hashCredential(def.username, def.password);
            localStorage.setItem(KEY_HASH(role), h);
            localStorage.setItem(KEY_USER(role), def.username);
          }
        } catch {
          // ignore
        }
        try {
          const sess = sessionStorage.getItem(KEY_SESSION(role));
          if (sess) {
            if (role === "staff") setStaffSession(sess);
            else setAdminSession(sess);
          }
        } catch {
          // ignore
        }
      }
      setHydrated(true);
    })();
  }, []);

  const signIn = useCallback(
    async (role: Role, username: string, password: string) => {
      try {
        const stored = localStorage.getItem(KEY_HASH(role));
        const storedUser = localStorage.getItem(KEY_USER(role)) ?? DEFAULT_CREDS[role].username;
        if (!stored) return false;
        if (username.toLowerCase().trim() !== storedUser.toLowerCase().trim()) return false;
        const h = await hashCredential(username, password);
        if (h !== stored) return false;
        if (role === "staff") {
          const serverOk = await establishStaffHttpSession(username, password);
          if (!serverOk) return false;
        }
        sessionStorage.setItem(KEY_SESSION(role), username);
        if (role === "staff") setStaffSession(username);
        else setAdminSession(username);
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const signOut = useCallback((role: Role) => {
    try {
      sessionStorage.removeItem(KEY_SESSION(role));
    } catch {
      // ignore
    }
    if (role === "staff") {
      setStaffSession(null);
      void fetch("/api/staff/session", { method: "DELETE", credentials: "include" });
    } else setAdminSession(null);
  }, []);

  const changeCredentials = useCallback(
    async (
      role: Role,
      currentPassword: string,
      newUsername: string,
      newPassword: string,
    ) => {
      try {
        const storedUser = localStorage.getItem(KEY_USER(role)) ?? DEFAULT_CREDS[role].username;
        const stored = localStorage.getItem(KEY_HASH(role));
        if (!stored) return false;
        const currentHash = await hashCredential(storedUser, currentPassword);
        if (currentHash !== stored) return false;
        const cleanUser = newUsername.trim() || storedUser;
        const cleanPwd = newPassword || currentPassword;
        if (role === "staff") {
          const serverOk = await establishStaffHttpSession(cleanUser, cleanPwd);
          if (!serverOk) return false;
        }
        const newHash = await hashCredential(cleanUser, cleanPwd);
        localStorage.setItem(KEY_USER(role), cleanUser);
        localStorage.setItem(KEY_HASH(role), newHash);
        sessionStorage.setItem(KEY_SESSION(role), cleanUser);
        if (role === "staff") setStaffSession(cleanUser);
        else setAdminSession(cleanUser);
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const value = useMemo<AuthCtx>(
    () => ({
      authedRole: staffSession ? "staff" : adminSession ? "admin" : null,
      signedInAs: { staff: staffSession, admin: adminSession },
      signIn,
      signOut,
      changeCredentials,
      hydrated,
    }),
    [staffSession, adminSession, signIn, signOut, changeCredentials, hydrated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
