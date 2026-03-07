"use client";

// app/admin/login/page.tsx
export const dynamic = "force-dynamic";

import { useState } from "react";
import styles from "./page.module.css";

export default function AdminLoginPage() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) return;
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
        window.location.href = "/admin/dashboard";
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

        <h1 className={styles.title}>Sign In</h1>
        <p className={styles.sub}>Restricted access — authorised personnel only.</p>

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="admin@supapi.app"
              autoComplete="email"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              placeholder="••••••••••••"
              autoComplete="current-password"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          {error && <div className={styles.error}>⚠ {error}</div>}

          <button onClick={handleSubmit} disabled={loading} className={styles.btn}>
            {loading ? "Verifying..." : "Sign In →"}
          </button>
        </div>

        <p className={styles.sub} style={{ marginTop: "16px", fontSize: "12px" }}>
          Supapi Admin Panel · v1.0
        </p>
      </div>
    </div>
  );
}