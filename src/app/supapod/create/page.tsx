"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./page.module.css";

const CATEGORIES = [
  { id: "comedy", label: "Comedy" },
  { id: "education", label: "Education" },
  { id: "true_crime", label: "True Crime" },
  { id: "news", label: "News" },
  { id: "music", label: "Music" },
  { id: "technology", label: "Technology" },
  { id: "others", label: "Others" },
];

export default function CreatePodcastPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [category, setCategory] = useState("others");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!title.trim()) { setError("Title required"); return; }
    const token = localStorage.getItem("supapi_token");
    if (!token) { router.push("/dashboard"); return; }
    setSaving(true); setError("");
    try {
      const r = await fetch("/api/supapod/podcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: title.trim(), description, cover_url: coverUrl || null, category }),
      });
      const d = await r.json();
      if (d.success) router.push(`/supapod/${d.data.id}`);
      else setError(d.error ?? "Failed");
    } catch { setError("Something went wrong"); }
    setSaving(false);
  };

  if (!user) return (
    <div className={styles.authWall}>
      <div className={styles.authIcon}>🔒</div>
      <div className={styles.authTitle}>Sign in to create</div>
      <button className={styles.authBtn} onClick={() => router.push("/dashboard")}>Sign In</button>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>← Back</button>
        <h1 className={styles.title}>Create Podcast</h1>
        <div />
      </div>
      <div className={styles.form}>
        <div className={styles.field}>
          <label>Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Your podcast name" />
        </div>
        <div className={styles.field}>
          <label>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="What's your podcast about?" />
        </div>
        <div className={styles.field}>
          <label>Cover URL</label>
          <input value={coverUrl} onChange={e => setCoverUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div className={styles.field}>
          <label>Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        {error && <div className={styles.error}>{error}</div>}
        <button className={styles.submitBtn} onClick={handleSubmit} disabled={saving}>
          {saving ? "Creating..." : "Create Podcast"}
        </button>
      </div>
    </div>
  );
}
