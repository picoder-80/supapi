"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./page.module.css";

export default function GoLivePage() {
  const { user } = useAuth();
  const router = useRouter();
  const token = () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.loginPrompt}>
          <div className={styles.loginIcon}>🪐</div>
          <div className={styles.loginTitle}>Sign in to go live</div>
          <Link href="/dashboard" className={styles.loginBtn}>Sign In with Pi</Link>
        </div>
      </div>
    );
  }

  const handleGoLive = async () => {
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ title: title.trim() || undefined }),
      });
      const d = await r.json();
      if (d.success) {
        router.push("/live");
      } else {
        setError(d.error ?? "Failed to start live");
      }
    } catch {
      setError("Something went wrong");
    }
    setSubmitting(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/live" className={styles.backBtn}>← Back</Link>
        <h1 className={styles.title}>Go Live</h1>
      </div>

      <div className={styles.body}>
        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.section}>
          <div className={styles.sectionLabel}>🔴 Live stream title (optional)</div>
          <input
            type="text"
            className={styles.input}
            placeholder="What are you streaming?"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={100}
          />
        </div>

        <button
          className={styles.goLiveBtn}
          onClick={handleGoLive}
          disabled={submitting}
        >
          {submitting ? "Starting..." : "Go Live"}
        </button>
      </div>
    </div>
  );
}
