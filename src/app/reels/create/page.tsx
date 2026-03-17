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
  const [isDragging, setIsDragging] = useState(false);

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

  const processFile = (file: File | null) => {
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
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFile(e.target.files?.[0] ?? null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFile(e.dataTransfer.files?.[0] ?? null);
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
        <button type="button" className={styles.backBtn} onClick={() => router.back()} aria-label="Back">
          <span className={styles.backIcon}>←</span>
          <span>Back</span>
        </button>
        <h1 className={styles.title}>Create Reel</h1>
        <button
          type="button"
          className={`${styles.postBtn} ${submitting ? styles.postBtnLoading : ""}`}
          onClick={handleSubmit}
          disabled={submitting || !videoFile}
        >
          {submitting ? (
            <>
              <span className={styles.spinner} aria-hidden />
              <span>Posting...</span>
            </>
          ) : (
            "Post"
          )}
        </button>
      </div>

      <div className={styles.body}>
        {error && (
          <div className={styles.errorBanner} role="alert">
            {error}
          </div>
        )}

        <section className={styles.section}>
          <label className={styles.sectionLabel}>Video</label>
          <div
            className={`${styles.videoDrop} ${videoPreview ? styles.videoDropFilled : ""} ${isDragging ? styles.videoDropDragging : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={handleFileChange}
              className={styles.hiddenInput}
              aria-label="Select video file"
            />
            {videoPreview ? (
              <div className={styles.videoPreviewWrap}>
                <video src={videoPreview} controls playsInline className={styles.videoPreview} />
                <div className={styles.videoOverlay}>
                  <span className={styles.changeVideoText}>Tap to change video</span>
                </div>
              </div>
            ) : (
              <div className={styles.videoPlaceholder}>
                <div className={styles.placeholderIconWrap}>
                  <svg className={styles.placeholderIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 7l-7 5 7 5V7z" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </div>
                <span className={styles.placeholderTitle}>Drop your video here</span>
                <span className={styles.placeholderSub}>or tap to browse</span>
                <span className={styles.placeholderHint}>MP4, WebM, MOV · max 50MB</span>
              </div>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <label className={styles.sectionLabel}>Caption</label>
          <div className={styles.captionWrap}>
            <textarea
              className={styles.captionInput}
              placeholder="Share your story..."
              value={caption}
              onChange={e => setCaption(e.target.value)}
              maxLength={2200}
              rows={3}
            />
            <div className={styles.charCount}>{caption.length}/2200</div>
          </div>
        </section>
      </div>
    </div>
  );
}
