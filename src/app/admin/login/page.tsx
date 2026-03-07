"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import styles from "./page.module.css";

const ADMIN_TOKEN_KEY = "supapi_admin_token";

export default function AdminLoginPage() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [checking, setChecking] = useState(true);

  // If already logged in, redirect
  useEffect(() => {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (token) {
      window.location.replace("/admin/dashboard");
    } else {
      setChecking(false);
    }
  }, []);

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

      if (data.success && data.data?.token) {
        localStorage.setItem(ADMIN_TOKEN_KEY, data.data.token);
        window.location.replace("/admin/dashboard");
      } else {
        setError(data.error ?? "Invalid credentials");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) return null;

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