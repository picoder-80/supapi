"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./page.module.css";

export default function AddEpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!audioFile || !title.trim()) { setError("Title and audio file required"); return; }
    const token = localStorage.getItem("supapi_token");
    if (!token) { router.push("/dashboard"); return; }

    setUploading(true); setError("");
    try {
      const fd = new FormData();
      fd.append("audio", audioFile);
      fd.append("podcast_id", id);
      const r = await fetch("/api/supapod/audio", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const d = await r.json();
      if (!d.success) { setError(d.error ?? "Upload failed"); setUploading(false); return; }

      const audioUrl = d.data.url;
      setSaving(true);
      const r2 = await fetch("/api/supapod/episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          podcast_id: id,
          title: title.trim(),
          description: description.trim(),
          audio_url: audioUrl,
          duration_sec: 0,
        }),
      });
      const d2 = await r2.json();
      if (d2.success) router.push(`/supapod/${id}`);
      else setError(d2.error ?? "Failed to create episode");
    } catch { setError("Something went wrong"); }
    setUploading(false); setSaving(false);
  };

  if (!user) return (
    <div className={styles.authWall}>
      <div className={styles.authIcon}>🔒</div>
      <button className={styles.authBtn} onClick={() => router.push("/dashboard")}>Sign In</button>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>← Back</button>
        <h1 className={styles.title}>Add Episode</h1>
        <div />
      </div>
      <div className={styles.form}>
        <div className={styles.field}>
          <label>Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Episode title" />
        </div>
        <div className={styles.field}>
          <label>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Episode description" />
        </div>
        <div className={styles.field}>
          <label>Audio File * (mp3, wav, ogg, max 100MB)</label>
          <input type="file" accept="audio/*" onChange={e => setAudioFile(e.target.files?.[0] ?? null)} />
          {audioFile && <span className={styles.fileName}>{audioFile.name}</span>}
        </div>
        {error && <div className={styles.error}>{error}</div>}
        <button className={styles.submitBtn} onClick={handleUpload} disabled={uploading || saving}>
          {uploading ? "Uploading..." : saving ? "Creating..." : "Add Episode"}
        </button>
      </div>
    </div>
  );
}
