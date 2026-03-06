"use client";

// app/admin/login/page.tsx

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res  = await fetch("/api/admin/auth", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success) {
        router.push("/admin/dashboard");
      } else {
        setError(data.error ?? "Invalid credentials");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>π</span>
          <div>
            <div className={styles.logoTitle}>Supapi</div>
            <div className={styles.logoBadge}>ADMIN ACCESS</div>
          </div>
        </div>

        <h1 className={styles.heading}>Sign In</h1>
        <p className={styles.sub}>Restricted access — authorised personnel only.</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="admin@supapi.app"
              required
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              placeholder="••••••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div className={styles.error}>⚠ {error}</div>}

          <button type="submit" disabled={loading} className={styles.btn}>
            {loading ? "Verifying..." : "Sign In →"}
          </button>
        </form>

        <p className={styles.footer}>
          Supapi Admin Panel · v1.0
        </p>
      </div>
    </div>
  );
}
