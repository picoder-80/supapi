"use client";
export const dynamic = "force-dynamic";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./page.module.css";

const CATEGORIES = [
  { key: "food",      label: "Food & Drink",  emoji: "🍜" },
  { key: "retail",    label: "Retail",        emoji: "🛍️" },
  { key: "services",  label: "Services",      emoji: "🔧" },
  { key: "online",    label: "Online",        emoji: "💻" },
  { key: "stay",      label: "Stay / Hotel",  emoji: "🏡" },
  { key: "transport", label: "Transport",     emoji: "🚗" },
  { key: "other",     label: "Other",         emoji: "📍" },
];

const MAX_IMAGES = 4;


export default function RegisterBusinessPage() {
  const router    = useRouter();
  const { user }  = useAuth();
  const fileRef   = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "", category: "food", description: "",
    address: "", city: "", state: "", country: "Malaysia",
    phone: "", website: "", pi_wallet: "",
    lat: "", lng: "",
  });

  const [images, setImages]       = useState<{ file: File; preview: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [msg, setMsg]               = useState("");
  const [locating, setLocating]     = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // ── Image handling ────────────────────────────────────────────────
  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) return;

    const toAdd: { file: File; preview: string }[] = [];
    for (const file of files.slice(0, remaining)) {
      
      if (!file.type.startsWith("image/")) continue;
      toAdd.push({ file, preview: URL.createObjectURL(file) });
    }
    setImages(prev => [...prev, ...toAdd]);
    // reset input so same file can be re-added after removal
    e.target.value = "";
  };

  const removeImage = (idx: number) => {
    setImages(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // Upload images to Supabase Storage, return URLs
  const uploadImages = async (token: string): Promise<string[]> => {
    if (images.length === 0) return [];
    setUploading(true);
    const urls: string[] = [];
    for (const img of images) {
      const fd = new FormData();
      fd.append("file", img.file!);
      try {
        const r = await fetch("/api/locator/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const d = await r.json();
        if (d.success && d.url) urls.push(d.url);
      } catch {}
    }
    setUploading(false);
    return urls;
  };

  // ── GPS ───────────────────────────────────────────────────────────
  const handleLocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        set("lat", String(pos.coords.latitude.toFixed(6)));
        set("lng", String(pos.coords.longitude.toFixed(6)));
        setLocating(false);
      },
      () => { setMsg("❌ Location access denied"); setLocating(false); }
    );
  };

  // ── Submit ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.name || !form.category || !form.address || !form.city) {
      setMsg("❌ Please fill in all required fields");
      return;
    }
    const token = localStorage.getItem("supapi_token");
    if (!token) { setMsg("❌ Please login first"); return; }

    setSubmitting(true);
    setMsg("");

    try {
      // Upload images first
      const imageUrls = await uploadImages(token);

      const r = await fetch("/api/locator", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          lat:       form.lat ? parseFloat(form.lat) : null,
          lng:       form.lng ? parseFloat(form.lng) : null,
          image_url: imageUrls[0] ?? null,       // primary image
          images:    imageUrls,                   // all images
        }),
      });
      const d = await r.json();
      if (d.success) {
        setMsg("✅ Submitted! Pending admin approval.");
        setTimeout(() => router.push("/locator"), 2000);
      } else {
        setMsg(`❌ ${d.error}`);
      }
    } catch { setMsg("❌ Network error"); }
    setSubmitting(false);
  };

  // ── Guest ─────────────────────────────────────────────────────────
  if (!user) return (
    <div className={styles.guestWrap}>
      <div className={styles.guestIcon}>📍</div>
      <div className={styles.guestTitle}>Login Required</div>
      <div className={styles.guestSub}>Please login with Pi to register your business.</div>
      <button className={styles.backBtn} onClick={() => router.push("/locator")}>← Back to Locator</button>
    </div>
  );

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>←</button>
        <div>
          <div className={styles.headerTitle}>Register Business</div>
          <div className={styles.headerSub}>List your Pi-accepting business</div>
        </div>
      </div>

      <div className={styles.body}>

        {/* Category */}
        <div className={styles.fieldGroup}>
          <div className={styles.groupTitle}>🏷️ Category *</div>
          <div className={styles.catGrid}>
            {CATEGORIES.map(c => (
              <button key={c.key} type="button"
                className={`${styles.catOption} ${form.category === c.key ? styles.catOptionActive : ""}`}
                onClick={() => set("category", c.key)}
              >
                <span className={styles.catEmoji}>{c.emoji}</span>
                <span className={styles.catLabel}>{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Basic Info */}
        <div className={styles.fieldGroup}>
          <div className={styles.groupTitle}>📋 Business Info</div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Business Name *</label>
            <input className={styles.input} placeholder="e.g. Kedai Makan Pi"
              value={form.name} onChange={e => set("name", e.target.value)} />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Description</label>
            <textarea className={styles.input} rows={3}
              placeholder="What does your business offer?"
              value={form.description} onChange={e => set("description", e.target.value)} />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Phone</label>
            <input className={styles.input} type="tel" placeholder="+60 1X-XXXXXXX"
              value={form.phone} onChange={e => set("phone", e.target.value)} />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Website</label>
            <input className={styles.input} type="url" placeholder="https://..."
              value={form.website} onChange={e => set("website", e.target.value)} />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Pi Wallet Address</label>
            <input className={styles.input} placeholder="Your Pi wallet address"
              value={form.pi_wallet} onChange={e => set("pi_wallet", e.target.value)} />
          </div>
        </div>

        {/* Photos */}
        <div className={styles.fieldGroup}>
          <div className={styles.groupTitle}>📸 Business Photos</div>
          <div className={styles.photoSub}>Upload up to {MAX_IMAGES} photos</div>

          <div className={styles.photoGrid}>
            {images.map((img, idx) => (
              <div key={idx} className={styles.photoThumb}>
                <img src={img.preview} alt="" className={styles.photoImg} />
                <button className={styles.photoRemove} onClick={() => removeImage(idx)}>✕</button>
                {idx === 0 && <div className={styles.photoPrimary}>Cover</div>}
              </div>
            ))}

            {images.length < MAX_IMAGES && (
              <button className={styles.photoAdd} onClick={() => fileRef.current?.click()}>
                <span className={styles.photoAddIcon}>+</span>
                <span className={styles.photoAddLabel}>Add Photo</span>
              </button>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={handleImagePick}
          />
        </div>

        {/* Location */}
        <div className={styles.fieldGroup}>
          <div className={styles.groupTitle}>📍 Location</div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Address *</label>
            <input className={styles.input} placeholder="Street address"
              value={form.address} onChange={e => set("address", e.target.value)} />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>City *</label>
            <input className={styles.input} placeholder="Kuala Lumpur"
              value={form.city} onChange={e => set("city", e.target.value)} />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>State</label>
            <input className={styles.input} placeholder="Selangor"
              value={form.state} onChange={e => set("state", e.target.value)} />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Country</label>
            <input className={styles.input} placeholder="Malaysia"
              value={form.country} onChange={e => set("country", e.target.value)} />
          </div>

          {/* GPS Coordinates */}
          <div className={styles.gpsBox}>
            <div className={styles.gpsHeader}>
              <div className={styles.gpsTitle}>GPS Coordinates</div>
              <div className={styles.gpsSub}>For accurate map pin placement</div>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Latitude</label>
              <input className={styles.input} placeholder="3.141200"
                value={form.lat} onChange={e => set("lat", e.target.value)} />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Longitude</label>
              <input className={styles.input} placeholder="101.686500"
                value={form.lng} onChange={e => set("lng", e.target.value)} />
            </div>

            <button type="button" className={styles.gpsBtn} onClick={handleLocate} disabled={locating}>
              {locating ? "⏳ Detecting location..." : "🎯 Use My Location"}
            </button>
          </div>
        </div>

        {msg && (
          <div className={`${styles.msg} ${msg.startsWith("✅") ? styles.msgSuccess : styles.msgError}`}>
            {msg}
          </div>
        )}

        <div className={styles.submitNote}>
          ℹ️ Your listing will be reviewed by admin before going live.
        </div>

        <button className={styles.submitBtn} onClick={handleSubmit}
          disabled={submitting || uploading}>
          {uploading ? "⏳ Uploading photos..." : submitting ? "Submitting..." : "📍 Submit Business"}
        </button>

      </div>
    </div>
  );
}