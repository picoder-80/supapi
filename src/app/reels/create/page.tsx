"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./create.module.css";

export default function CreateReelPage() {
  const { user } = useAuth();
  const router = useRouter();
  const token = () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.loginPrompt}>
          <div className={styles.loginIcon}>🎬</div>
          <div className={styles.loginTitle}>Sign in to upload reels</div>
          <Link href="/dashboard" className={styles.loginBtn}>Sign In with Pi</Link>
        </div>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError("Please select a video file (MP4, WebM or MOV)");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("Video must be under 50MB");
      return;
    }
    setError("");
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!videoFile) {
      setError("Select a video first");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const fd = new FormData();
      fd.append("video", videoFile);
      const uploadRes = await fetch("/api/reels/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
        body: fd,
      });
      const uploadData = await uploadRes.json();

      if (!uploadData.success || !uploadData.data?.url) {
        setError(uploadData.error ?? "Upload failed");
        setSubmitting(false);
        return;
      }

      const saveRes = await fetch("/api/reels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ video_url: uploadData.data.url, caption }),
      });
      const saveData = await saveRes.json();

      if (!saveData.success) {
        setError(saveData.error ?? "Failed to save reel");
        setSubmitting(false);
        return;
      }

      router.push("/reels");
    } catch {
      setError("Something went wrong");
    }
    setSubmitting(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>← Back</button>
        <h1 className={styles.title}>Upload Reel</h1>
        <button className={styles.postBtn} onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Uploading..." : "Post 🎬"}
        </button>
      </div>

      <div className={styles.body}>
        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.section}>
          <div className={styles.sectionLabel}>🎬 Video</div>
          <div
            className={styles.videoDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={handleFileChange}
              className={styles.hiddenInput}
            />
            {videoPreview ? (
              <video src={videoPreview} controls className={styles.videoPreview} />
            ) : (
              <div className={styles.videoPlaceholder}>
                <span className={styles.placeholderIcon}>🎬</span>
                <span>Tap to select video (MP4, WebM, MOV — max 50MB)</span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>✍️ Caption</div>
          <textarea
            className={styles.captionInput}
            placeholder="Add a caption..."
            value={caption}
            onChange={e => setCaption(e.target.value)}
            maxLength={2200}
            rows={3}
          />
          <div className={styles.charCount}>{caption.length}/2200</div>
        </div>
      </div>
    </div>
  );
}
