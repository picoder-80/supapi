"use client";

// components/providers/AuthProvider.tsx

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { authenticateWithPi } from "@/lib/pi/sdk";
import type { User } from "@/types";

interface AuthContextType {
  user:         User | null;
  isLoading:    boolean;
  isHydrating:  boolean; // true while checking existing session on mount
  login:        (referralCode?: string) => Promise<void>;
  logout:       () => Promise<void>;
  setUser:      (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user:        null,
  isLoading:   false,
  isHydrating: true,
  login:       async () => {},
  logout:      async () => {},
  setUser:     () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,        setUser]        = useState<User | null>(null);
  const [isLoading,   setIsLoading]   = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);

  // ✅ On mount — restore session from cookie if exists
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.user) {
            setUser(data.data.user);
            console.log("[Auth] Session restored:", data.data.user.username);
          }
        }
      } catch (err) {
        console.warn("[Auth] Could not restore session:", err);
      } finally {
        setIsHydrating(false);
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async (referralCode?: string) => {
    setIsLoading(true);
    try {
      console.log("[Auth] Starting Pi.authenticate()...");
      const authResult = await authenticateWithPi();
      console.log("[Auth] Pi.authenticate() success:", authResult.user.username);

      console.log("[Auth] Calling /api/auth/pi...");
      const res  = await fetch("/api/auth/pi", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ authResult, referralCode }),
      });

      const data = await res.json();
      console.log("[Auth] Server response:", res.status, data);

      if (data.success) {
        setUser(data.data.user);
        console.log("[Auth] Login success:", data.data.user.username);
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
    await fetch("/api/auth/pi", { method: "DELETE" });
    setUser(null);
    console.log("[Auth] Logged out");
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isHydrating, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);