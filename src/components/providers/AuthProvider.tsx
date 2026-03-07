"use client";

// components/providers/AuthProvider.tsx

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { authenticateWithPi } from "@/lib/pi/sdk";
import type { User } from "@/types";

const TOKEN_KEY       = "supapi_token";
const ADMIN_TOKEN_KEY = "supapi_admin_token";

interface AuthContextType {
  user:        User | null;
  isLoading:   boolean;
  isHydrating: boolean;
  login:       (referralCode?: string) => Promise<void>;
  logout:      () => Promise<void>;
  setUser:     (user: User | null) => void;
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

  // Restore session from localStorage on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return;

        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.user) {
            setUser(data.data.user);
          }
        } else {
          // Token invalid — clear it
          localStorage.removeItem(TOKEN_KEY);
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
      const authResult = await authenticateWithPi();

      const res  = await fetch("/api/auth/pi", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ authResult, referralCode }),
      });

      const data = await res.json();

      if (data.success) {
        // Save token to localStorage
        if (data.data?.token) {
          localStorage.setItem(TOKEN_KEY, data.data.token);
        }
        setUser(data.data.user);
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
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    await fetch("/api/auth/pi", { method: "DELETE" });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isHydrating, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);