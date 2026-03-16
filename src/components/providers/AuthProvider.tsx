"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { authenticateWithPi } from "@/lib/pi/sdk";
import type { User } from "@/types";

const TOKEN_KEY       = "supapi_token";
const ADMIN_TOKEN_KEY = "supapi_admin_token";
const LOGOUT_COOLDOWN_MS = 2000; // Ignore focus restore for 2s after logout

interface AuthContextType {
  user:        User | null;
  isLoading:   boolean;
  isHydrating: boolean;
  login:       (referralCode?: string) => Promise<void>;
  logout:      () => Promise<void>;
  setUser:     (user: User | null) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user:        null,
  isLoading:   false,
  isHydrating: true,
  login:       async () => {},
  logout:      async () => {},
  setUser:     () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,        setUser]        = useState<User | null>(null);
  const [isLoading,   setIsLoading]   = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const logoutAtRef   = useRef<number>(0);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.user) return data.data.user as User;
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch {}
    return null;
  }, []);

  // Restore session on mount
  useEffect(() => {
    fetchUser().then(u => {
      if (u) setUser(u);
    }).finally(() => setIsHydrating(false));
  }, [fetchUser]);

  // Refresh user when tab regains focus (picks up avatar changes from MySpace)
  // Skip restore after logout to avoid race: focus fires → fetchUser starts → user clicks logout → fetchUser completes and wrongly restores user
  useEffect(() => {
    const onFocus = async () => {
      if (!localStorage.getItem(TOKEN_KEY)) return;
      if (Date.now() - logoutAtRef.current < LOGOUT_COOLDOWN_MS) return;
      const u = await fetchUser();
      if (u && localStorage.getItem(TOKEN_KEY)) setUser(u);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchUser]);

  const refreshUser = useCallback(async () => {
    const u = await fetchUser();
    if (u) setUser(u);
  }, [fetchUser]);

  const login = useCallback(async (referralCode?: string) => {
    setIsLoading(true);
    try {
      const authResult = await authenticateWithPi();
      const res  = await fetch("/api/auth/pi", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ authResult, referralCode }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.data?.token) localStorage.setItem(TOKEN_KEY, data.data.token);
        setUser(data.data.user);
        window.location.href = "/dashboard";
      } else {
        throw new Error(data.error ?? "Login failed");
      }
    } catch (err) {
      console.error("[Auth] Login error:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    logoutAtRef.current = Date.now();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    await fetch("/api/auth/pi", { method: "DELETE" });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isHydrating, login, logout, setUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);