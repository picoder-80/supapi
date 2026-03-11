"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./create.module.css";

const CATEGORIES = [
  { id: "food",      emoji: "🍜", label: "Food"      },
  { id: "travel",    emoji: "✈️", label: "Travel"    },
  { id: "fashion",   emoji: "👗", label: "Fashion"   },
  { id: "beauty",    emoji: "💄", label: "Beauty"    },
  { id: "fitness",   emoji: "💪", label: "Fitness"   },
  { id: "home",      emoji: "🏠", label: "Home"      },
  { id: "tech",      emoji: "📱", label: "Tech"      },
  { id: "lifestyle", emoji: "🌿", label: "Lifestyle" },
  { id: "finance",   emoji: "💰", label: "Finance"   },
  { id: "pi",        emoji: "π",  label: "Pi Life"   },
];

export default function CreateLivviPost() {
  const { user } = useAuth();
  const router   = useRouter();
  const token    = () => typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "";

  const [caption,    setCaption]    = useState("");
  const [category,   setCategory]   = useState("lifestyle");
  const [location,   setLocation]   = useState("");
  const [hashInput,  setHashInput]  = useState("");
  const [hashtags,   setHashtags]   = useState<string[]>([]);
  const [imageUrls,  setImageUrls]  = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.loginPrompt}>
          <div className={styles.loginIcon}>✨</div>
          <div className={styles.loginTitle}>Sign in to post on SupaLivvi</div>
          <button className={styles.loginBtn} onClick={() => router.push("/dashboard")}>
            Sign In with Pi
          </button>
        </div>
      </div>
    );
  }

  const addHashtag = () => {
    const h = hashInput.replace(/^#/, "").trim().toLowerCase();
    if (h && !hashtags.includes(h) && hashtags.length < 10) {
      setHashtags(prev => [...prev, h]);
    }
    setHashInput("");
  };

  const removeHashtag = (h: string) => setHashtags(prev => prev.filter(t => t !== h));

  const addImageSlot = () => {
    if (imageUrls.length < 9) setImageUrls(prev => [...prev, ""]);
  };

  const updateImage = (i: number, val: string) => {
    setImageUrls(prev => { const n = [...prev]; n[i] = val; return n; });
  };

  const removeImage = (i: number) => {
    setImageUrls(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    const validImages = imageUrls.filter(u => u.trim());
    if (!validImages.length) { setError("Add at least one image URL"); return; }
    if (!caption.trim())     { setError("Caption is required"); return; }
    setSubmitting(true); setError("");

    try {
      const r = await fetch("/api/supa-livvi", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ caption, images: validImages, category, hashtags, location }),
      });
      const d = await r.json();
      if (d.success) {
        router.push("/supa-livvi");
      } else {
        setError(d.error ?? "Failed to post");
      }
    } catch {
      setError("Something went wrong");
    }
    setSubmitting(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>← Back</button>
        <h1 className={styles.title}>New Post</h1>
        <button className={styles.postBtn} onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Posting..." : "Post ✨"}
        </button>
      </div>

      <div className={styles.body}>
        {error && <div className={styles.errorBanner}>{error}</div>}

        {/* Images */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>📸 Images <span className={styles.hint}>(up to 9)</span></div>
          <div className={styles.imageList}>
            {imageUrls.map((url, i) => (
              <div key={i} className={styles.imageRow}>
                <div className={styles.imagePreview}>
                  {url ? (
                    <img src={url} alt="" className={styles.imagePreviewImg} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <span className={styles.imagePreviewPlaceholder}>🖼️</span>
                  )}
                </div>
                <input
                  className={styles.imageInput}
                  placeholder="Paste image URL..."
                  value={url}
                  onChange={e => updateImage(i, e.target.value)}
                />
                {imageUrls.length > 1 && (
                  <button className={styles.removeImageBtn} onClick={() => removeImage(i)}>✕</button>
                )}
              </div>
            ))}
          </div>
          {imageUrls.length < 9 && (
            <button className={styles.addImageBtn} onClick={addImageSlot}>+ Add another image</button>
          )}
        </div>

        {/* Caption */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>✍️ Caption</div>
          <textarea
            className={styles.captionInput}
            placeholder="Share your story, tips, or experience..."
            value={caption}
            onChange={e => setCaption(e.target.value)}
            maxLength={500}
            rows={4}
          />
          <div className={styles.charCount}>{caption.length}/500</div>
        </div>

        {/* Category */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>🏷️ Category</div>
          <div className={styles.catGrid}>
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                className={`${styles.catOpt} ${category === c.id ? styles.catOptActive : ""}`}
                onClick={() => setCategory(c.id)}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hashtags */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>
            # Hashtags <span className={styles.hint}>({hashtags.length}/10)</span>
          </div>
          <div className={styles.hashRow}>
            <input
              className={styles.hashInput}
              placeholder="#lifestyle"
              value={hashInput}
              onChange={e => setHashInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); addHashtag(); } }}
            />
            <button className={styles.hashAddBtn} onClick={addHashtag}>Add</button>
          </div>
          {hashtags.length > 0 && (
            <div className={styles.hashList}>
              {hashtags.map(h => (
                <span key={h} className={styles.hashTag}>
                  #{h} <button className={styles.hashRemove} onClick={() => removeHashtag(h)}>✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Location */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>📍 Location <span className={styles.hint}>(optional)</span></div>
          <input
            className={styles.locationInput}
            placeholder="e.g. Kuala Lumpur, Malaysia"
            value={location}
            onChange={e => setLocation(e.target.value)}
            maxLength={80}
          />
        </div>

        {/* SC Bonus hint */}
        <div className={styles.scHint}>
          💎 First post bonus: <strong>+20 SC</strong>
        </div>
      </div>
    </div>
  );
}
