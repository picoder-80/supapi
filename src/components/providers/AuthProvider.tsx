"use client";

// components/providers/AuthProvider.tsx

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { authenticateWithPi } from "@/lib/pi/sdk";
import type { User } from "@/types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (referralCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  login: async () => {},
  logout: async () => {},
  setUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (referralCode?: string) => {
    setIsLoading(true);
    try {
      const authResult = await authenticateWithPi();

      const res = await fetch("/api/auth/pi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: authResult.accessToken,
          referralCode,
        }),
      });

      const data = await res.json();
      if (data.success) {
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
    await fetch("/api/auth/pi", { method: "DELETE" });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
