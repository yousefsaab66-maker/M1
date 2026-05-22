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

function clearClientStaffSession() {
  try {
    sessionStorage.removeItem(KEY_SESSION("staff"));
  } catch {
    // ignore
  }
}

const DEFAULT_CREDS: Record<Role, { username: string; password: string }> = {
  staff: { username: "staff", password: "staff12345678" },
  admin: { username: "admin", password: "admin123" },
};

export type StaffSessionError =
  | "network"
  | "invalid_credentials"
  | "rate_limited"
  | "server_misconfigured"
  | "invalid_json"
  | "unknown";

export async function establishStaffHttpSession(
  username: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: StaffSessionError }> {
  let res: Response;
  try {
    res = await fetch("/api/staff/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: username.trim(), password }),
    });
  } catch {
    return { ok: false, error: "network" };
  }
  let body: { ok?: boolean; error?: string } = {};
  try {
    body = (await res.json()) as { ok?: boolean; error?: string };
  } catch {
    body = {};
  }
  if (res.ok && body.ok === true) return { ok: true };
  const code = body.error;
  if (code === "invalid_credentials") return { ok: false, error: "invalid_credentials" };
  if (code === "rate_limited") return { ok: false, error: "rate_limited" };
  if (code === "server_misconfigured") return { ok: false, error: "server_misconfigured" };
  if (code === "invalid_json") return { ok: false, error: "invalid_json" };
  if (res.status === 401) return { ok: false, error: "invalid_credentials" };
  if (res.status === 429) return { ok: false, error: "rate_limited" };
  if (res.status === 500) return { ok: false, error: "server_misconfigured" };
  return { ok: false, error: "unknown" };
}

type AuthCtx = {
  authedRole: Role | null;
  signedInAs: { staff: string | null; admin: string | null };
  signIn: (
    role: Role,
    username: string,
    password: string,
  ) => Promise<boolean | StaffSessionError>;
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
        if (role === "admin") {
          try {
            const sess = sessionStorage.getItem(KEY_SESSION(role));
            if (sess) setAdminSession(sess);
          } catch {
            // ignore
          }
        }
      }

      let staffUser: string | null = null;
      try {
        const res = await fetch("/api/staff/session", { credentials: "include" });
        const body = (await res.json()) as { ok?: boolean; user?: string | null };
        if (res.ok && body.ok && body.user) staffUser = body.user;
      } catch {
        // ignore
      }
      if (staffUser) {
        try {
          sessionStorage.setItem(KEY_SESSION("staff"), staffUser);
        } catch {
          // ignore
        }
        setStaffSession(staffUser);
      } else {
        clearClientStaffSession();
        setStaffSession(null);
      }

      setHydrated(true);
    })();
  }, []);

  const signIn = useCallback(async (role: Role, username: string, password: string) => {
    try {
      const cleanUser = username.trim();
      if (role === "staff") {
        const server = await establishStaffHttpSession(cleanUser, password);
        if (!server.ok) return server.error;
        const h = await hashCredential(cleanUser, password);
        localStorage.setItem(KEY_USER(role), cleanUser);
        localStorage.setItem(KEY_HASH(role), h);
        sessionStorage.setItem(KEY_SESSION(role), cleanUser);
        setStaffSession(cleanUser);
        return true;
      }
      const stored = localStorage.getItem(KEY_HASH(role));
      const storedUser = localStorage.getItem(KEY_USER(role)) ?? DEFAULT_CREDS[role].username;
      if (!stored) return false;
      if (cleanUser.toLowerCase() !== storedUser.toLowerCase().trim()) return false;
      const h = await hashCredential(cleanUser, password);
      if (h !== stored) return false;
      sessionStorage.setItem(KEY_SESSION(role), cleanUser);
      setAdminSession(cleanUser);
      return true;
    } catch {
      return false;
    }
  }, []);

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
          const server = await establishStaffHttpSession(cleanUser, cleanPwd);
          if (!server.ok) return false;
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
