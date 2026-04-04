"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./create.module.css";

const CATEGORIES = [
  { id: "food", emoji: "🍜", label: "Food" },
  { id: "travel", emoji: "✈️", label: "Travel" },
  { id: "fashion", emoji: "👗", label: "Fashion" },
  { id: "beauty", emoji: "💄", label: "Beauty" },
  { id: "fitness", emoji: "💪", label: "Fitness" },
  { id: "home", emoji: "🏠", label: "Home" },
  { id: "tech", emoji: "📱", label: "Tech" },
  { id: "lifestyle", emoji: "🌿", label: "Lifestyle" },
  { id: "finance", emoji: "💰", label: "Finance" },
  { id: "pi", emoji: "π", label: "Pi Life" },
];

type ImageSlot = {
  url: string;
  file?: File;
  /** object URL for preview when `file` is set */
  preview?: string;
};

function revokePreview(slot: ImageSlot) {
  if (slot.preview) URL.revokeObjectURL(slot.preview);
}

export default function CreateLivviPost() {
  const { user } = useAuth();
  const router = useRouter();
  const token = useCallback(
    () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : ""),
    []
  );

  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("lifestyle");
  const [location, setLocation] = useState("");
  const [hashtagDraft, setHashtagDraft] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [imageSlots, setImageSlots] = useState<ImageSlot[]>([{ url: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const imageSlotsRef = useRef(imageSlots);
  imageSlotsRef.current = imageSlots;
  useEffect(() => {
    return () => {
      imageSlotsRef.current.forEach(revokePreview);
    };
  }, []);

  const addImageSlot = () => {
    if (imageSlots.length < 9) setImageSlots((prev) => [...prev, { url: "" }]);
  };

  const setSlotUrl = (index: number, url: string) => {
    setImageSlots((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        revokePreview(s);
        return { url };
      })
    );
  };

  const setSlotFile = (index: number, file: File | null) => {
    setImageSlots((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        revokePreview(s);
        if (!file) return { url: s.url };
        return { url: "", file, preview: URL.createObjectURL(file) };
      })
    );
  };

  const removeImageSlot = (index: number) => {
    setImageSlots((prev) => {
      const removed = prev[index];
      if (removed) revokePreview(removed);
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [{ url: "" }];
    });
  };

  const addHashtag = () => {
    const h = hashtagDraft.replace(/^#/, "").trim().toLowerCase();
    if (h && !hashtags.includes(h) && hashtags.length < 10) {
      setHashtags((prev) => [...prev, h]);
    }
    setHashtagDraft("");
  };

  const removeHashtag = (h: string) => setHashtags((prev) => prev.filter((t) => t !== h));

  const collectImageUrls = async (): Promise<string[] | null> => {
    const out: string[] = [];
    const auth = token();
    for (const slot of imageSlots) {
      if (slot.file) {
        const fd = new FormData();
        fd.append("file", slot.file);
        const r = await fetch("/api/supa-livvi/upload", {
          method: "POST",
          headers: auth ? { Authorization: `Bearer ${auth}` } : {},
          body: fd,
        });
        const d = (await r.json()) as { success?: boolean; url?: string; error?: string };
        if (!d.success || !d.url) {
          setError(d.error ?? "Image upload failed");
          return null;
        }
        out.push(d.url);
      } else if (slot.url.trim()) {
        out.push(slot.url.trim());
      }
    }
    return out;
  };

  const handleSubmit = async () => {
    if (!caption.trim()) {
      setError("Caption is required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const validImages = await collectImageUrls();
      if (validImages === null) {
        setSubmitting(false);
        return;
      }
      if (!validImages.length) {
        setError("Add at least one image (upload or paste a URL)");
        setSubmitting(false);
        return;
      }

      const r = await fetch("/api/supa-livvi", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          caption,
          images: validImages,
          category,
          hashtags,
          location,
        }),
      });
      const d = (await r.json()) as {
        success?: boolean;
        error?: string;
        firstPostBonusGranted?: boolean;
      };
      if (d.success) {
        if (d.firstPostBonusGranted && typeof window !== "undefined") {
          sessionStorage.setItem("livvi_first_bonus", "1");
        }
        router.push("/supa-livvi");
      } else {
        setError(d.error ?? "Failed to post");
      }
    } catch {
      setError("Something went wrong");
    }
    setSubmitting(false);
  };

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.loginPrompt}>
          <div className={styles.loginIcon}>✨</div>
          <div className={styles.loginTitle}>Sign in to post on SupaLivvi</div>
          <button type="button" className={styles.loginBtn} onClick={() => router.push("/dashboard")}>
            Sign In with Pi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={() => router.back()}>
          ← Back
        </button>
        <h1 className={styles.title}>New Post</h1>
        <button type="button" className={styles.postBtn} onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Posting..." : "Post ✨"}
        </button>
      </div>

      <div className={styles.body}>
        {error ? <div className={styles.errorBanner}>{error}</div> : null}

        <div className={styles.section}>
          <div className={styles.sectionLabel}>
            📸 Images <span className={styles.hint}>(up to 9 — upload or URL)</span>
          </div>
          <div className={styles.imageList}>
            {imageSlots.map((slot, i) => {
              const src = slot.preview || slot.url;
              return (
                <div key={i} className={styles.imageRow}>
                  <div className={styles.imagePreview}>
                    {src ? (
                      <img key={src} src={src} alt="" className={styles.imagePreviewImg} />
                    ) : (
                      <span className={styles.imagePreviewPlaceholder}>🖼️</span>
                    )}
                  </div>
                  <div className={styles.imageFieldCol}>
                    <div className={styles.imageActions}>
                      <input
                        id={`livvi-file-${i}`}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className={styles.srOnly}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) setSlotFile(i, f);
                          e.target.value = "";
                        }}
                      />
                      <label htmlFor={`livvi-file-${i}`} className={styles.chooseFileBtn}>
                        📷 Choose photo
                      </label>
                      {slot.file ? (
                        <button type="button" className={styles.useUrlLink} onClick={() => setSlotFile(i, null)}>
                          Use URL instead
                        </button>
                      ) : null}
                    </div>
                    <input
                      className={styles.imageInput}
                      placeholder="Or paste image URL (https://…)"
                      value={slot.file ? "" : slot.url}
                      disabled={Boolean(slot.file)}
                      onChange={(e) => setSlotUrl(i, e.target.value)}
                    />
                  </div>
                  {imageSlots.length > 1 ? (
                    <button type="button" className={styles.removeImageBtn} onClick={() => removeImageSlot(i)}>
                      ✕
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
          {imageSlots.length < 9 ? (
            <button type="button" className={styles.addImageBtn} onClick={addImageSlot}>
              + Add another image
            </button>
          ) : null}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>✍️ Caption</div>
          <textarea
            className={styles.captionInput}
            placeholder="Share your story, tips, or experience..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={500}
            rows={4}
          />
          <div className={styles.charCount}>{caption.length}/500</div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>🏷️ Category</div>
          <div className={styles.catGrid}>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`${styles.catOpt} ${category === c.id ? styles.catOptActive : ""}`}
                onClick={() => setCategory(c.id)}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>
            # Hashtags <span className={styles.hint}>({hashtags.length}/10)</span>
          </div>
          <div className={styles.hashRow}>
            <input
              className={styles.hashInput}
              placeholder="#lifestyle"
              value={hashtagDraft}
              onChange={(e) => setHashtagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  addHashtag();
                }
              }}
            />
            <button type="button" className={styles.hashAddBtn} onClick={addHashtag}>
              Add
            </button>
          </div>
          {hashtags.length > 0 ? (
            <div className={styles.hashList}>
              {hashtags.map((h) => (
                <span key={h} className={styles.hashTag}>
                  #{h}{" "}
                  <button type="button" className={styles.hashRemove} onClick={() => removeHashtag(h)}>
                    ✕
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>
            📍 Location <span className={styles.hint}>(optional)</span>
          </div>
          <input
            className={styles.locationInput}
            placeholder="e.g. Los Angeles, United States"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={80}
          />
        </div>

        <div className={styles.scHint}>
          💎 First post bonus: <strong>+20 SC</strong>
        </div>
      </div>
    </div>
  );
}
