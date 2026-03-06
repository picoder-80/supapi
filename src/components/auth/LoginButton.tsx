"use client";

// components/auth/LoginButton.tsx

import { useAuth } from "@/components/providers/AuthProvider";
import { usePi } from "@/components/providers/PiProvider";
import styles from "./LoginButton.module.css";

interface Props {
  referralCode?: string;
  onSuccess?: () => void;
}

export default function LoginButton({ referralCode, onSuccess }: Props) {
  const { user, login, logout, isLoading } = useAuth();
  const { isPiBrowser: inPi } = usePi();

  const handleLogin = async () => {
    try {
      await login(referralCode);
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      alert(msg);
    }
  };

  if (user) {
    return (
      <div className={styles.userBox}>
        <span className={styles.username}>π {user.username}</span>
        <button onClick={logout} className={styles.logoutBtn}>Sign Out</button>
      </div>
    );
  }

  if (!inPi) {
    return (
      <div className={styles.warning}>
        ⚠️ Please open in <strong>Pi Browser</strong>
      </div>
    );
  }

  return (
    <button onClick={handleLogin} disabled={isLoading} className={styles.loginBtn}>
      {isLoading ? "Signing in..." : "π Sign in with Pi"}
    </button>
  );
}
