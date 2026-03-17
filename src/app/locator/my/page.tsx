"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./page.module.css";

const CATEGORIES = [
  { key: "food",      label: "Food & Drink",  emoji: "🍜" },
  { key: "retail",    label: "Retail",        emoji: "🛍️" },
  { key: "services",  label: "Services",      emoji: "🔧" },
  { key: "online",    label: "Online",        emoji: "💻" },
  { key: "stay",      label: "SupaStay / Hotel", emoji: "🏡" },
  { key: "transport", label: "Transport",     emoji: "🚗" },
  { key: "other",     label: "Other",         emoji: "📍" },
];

interface Business {
  id: string; name: string; category: string; description: string;
  address: string; city: string; state: string; country: string;
  lat: number | null; lng: number | null;
  phone: string; website: string; pi_wallet: string; image_url: string;
  images: string[];
  opening_hours?: { day: string; time: string }[];
  status: string; verified: boolean;
  avg_rating: number; review_count: number;
  created_at: string; updated_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:  { label: "Under Review", color: "#f39c12", bg: "rgba(243,156,18,0.1)",  icon: "⏳" },
  approved: { label: "Live",         color: "#27ae60", bg: "rgba(39,174,96,0.1)",   icon: "✅" },
  rejected: { label: "Rejected",     color: "#e74c3c", bg: "rgba(231,76,60,0.08)",  icon: "❌" },
};

const MAX_IMAGES = 4;

export default function MyListingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [listings, setListings]     = useState<Business[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState<Business | null>(null);
  const [deleting, setDeleting]     = useState<Business | null>(null);
  const [saving, setSaving]         = useState(false);
  const [deletingId, setDeletingId] = useState(false);
  const [msg, setMsg]               = useState("");
  const [locating, setLocating]     = useState(false);
  const [uploading, setUploading]   = useState(false);

  // Edit form state
  const [form, setForm] = useState<Partial<Business>>({});
  const [images, setImages] = useState<{ file?: File; preview: string; existing?: string }[]>([]);
  const [openingHours, setOpeningHours] = useState<{ day: string; time: string }[]>([]);

  const token = () => localStorage.getItem("supapi_token") ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/locator/my", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (d.success) setListings(d.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setOpenTime = (day: string, time: string) =>
    setOpeningHours(prev => prev.map(h => h.day === day ? { ...h, time } : h));

  // ── Open edit modal ────────────────────────────────────────────────
  const openEdit = (b: Business) => {
    setEditing(b);
    setForm({ ...b });
    // Prefill all existing images
    const existingImgs = b.images?.length > 0
      ? b.images.map(url => ({ preview: url, existing: url }))
      : b.image_url ? [{ preview: b.image_url, existing: b.image_url }] : [];
    setImages(existingImgs);
    setMsg("");
  };

  // ── Image handling ─────────────────────────────────────────────────
  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = MAX_IMAGES - images.length;
    const toAdd: { file: File; preview: string }[] = [];
    for (const file of files.slice(0, remaining)) {
      
      if (!file.type.startsWith("image/")) continue;
      toAdd.push({ file, preview: URL.createObjectURL(file) });
    }
    setImages(prev => [...prev, ...toAdd]);
    e.target.value = "";
  };

  const removeImage = (idx: number) => {
    setImages(prev => {
      if (!prev[idx].existing) URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const uploadNewImages = async (): Promise<{ imageUrl: string | null; allUrls: string[] }> => {
    setUploading(true);
    const allUrls: string[] = [];
    for (const img of images) {
      if (img.existing) {
        allUrls.push(img.existing);
        continue;
      }
      if (!img.file) continue;
      const fd = new FormData();
      fd.append("file", img.file);
      try {
        const r = await fetch("/api/locator/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token()}` },
          body: fd,
        });
        const d = await r.json();
        if (d.success && d.url) allUrls.push(d.url);
      } catch {}
    }
    setUploading(false);
    return { imageUrl: allUrls[0] ?? null, allUrls };
  };

  // ── GPS ────────────────────────────────────────────────────────────
  const handleLocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        set("lat", String(pos.coords.latitude.toFixed(6)));
        set("lng", String(pos.coords.longitude.toFixed(6)));
        setLocating(false);
      },
      () => setLocating(false)
    );
  };

  // ── Save edit ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!editing || !form.name || !form.address || !form.city) {
      setMsg("❌ Please fill in required fields");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const { imageUrl, allUrls } = await uploadNewImages();
      const r = await fetch(`/api/locator/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          ...form,
          lat: form.lat ? parseFloat(String(form.lat)) : null,
          lng: form.lng ? parseFloat(String(form.lng)) : null,
          image_url: imageUrl,
          images: allUrls,
          opening_hours: openingHours,
        }),
      });
      const d = await r.json();
      if (d.success) {
        setMsg("✅ Saved! Listing is now under review.");
        setTimeout(() => { setEditing(null); load(); }, 1800);
      } else {
        setMsg(`❌ ${d.error}${d.debug ? ` (${JSON.stringify(d.debug)})` : ""}`);
      }
    } catch (e: any) { setMsg(`❌ Network error: ${e.message}`); }
    setSaving(false);
  };

  // ── Delete ─────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingId(true);
    try {
      const r = await fetch(`/api/locator/${deleting.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (d.success) {
        setDeleting(null);
        load();
      } else {
        alert(`❌ ${d.error}`);
      }
    } catch (e: any) { alert(`❌ Network error: ${e.message}`); }
    setDeletingId(false);
  };

  // ── Guest ──────────────────────────────────────────────────────────
  if (!user) return (
    <div className={styles.guestWrap}>
      <div className={styles.guestIcon}>📍</div>
      <div className={styles.guestTitle}>Login Required</div>
      <div className={styles.guestSub}>Please login with Pi to manage your listings.</div>
      <button className={styles.backBtn} onClick={() => router.push("/locator")}>← Back</button>
    </div>
  );

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>←</button>
        <div className={styles.headerText}>
          <div className={styles.headerTitle}>My Listings</div>
          <div className={styles.headerSub}>{listings.length} business{listings.length !== 1 ? "es" : ""} registered</div>
        </div>
        <button className={styles.addBtn} onClick={() => router.push("/locator/register")}>+ Add</button>
      </div>

      <div className={styles.body}>
        {loading ? (
          [...Array(2)].map((_, i) => <div key={i} className={styles.skeleton} />)
        ) : listings.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🏪</div>
            <div className={styles.emptyTitle}>No listings yet</div>
            <div className={styles.emptySub}>Register your Pi-accepting business to get discovered.</div>
            <button className={styles.emptyBtn} onClick={() => router.push("/locator/register")}>
              + Register Business
            </button>
          </div>
        ) : (
          listings.map(b => {
            const st = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.pending;
            const cat = CATEGORIES.find(c => c.key === b.category);
            return (
              <div key={b.id} className={styles.listingCard}>
                <div className={styles.listingTop}>
                  {(b.images?.length > 0 ? b.images[0] : b.image_url)
                    ? <img src={b.images?.length > 0 ? b.images[0] : b.image_url} alt={b.name} className={styles.listingImg} />
                    : <div className={styles.listingImgPlaceholder}>{cat?.emoji ?? "📍"}</div>
                  }
                  <div className={styles.listingInfo}>
                    <div className={styles.listingName}>{b.name}</div>
                    <div className={styles.listingCat}>{cat?.emoji} {cat?.label}</div>
                    <div className={styles.listingAddr}>📍 {b.city}</div>
                    {b.avg_rating > 0 && (
                      <div className={styles.listingRating}>⭐ {b.avg_rating.toFixed(1)} ({b.review_count})</div>
                    )}
                  </div>
                  <div className={styles.statusBadge} style={{ color: st.color, background: st.bg }}>
                    {st.icon} {st.label}
                  </div>
                </div>

                {b.status === "rejected" && (
                  <div className={styles.rejectedNote}>
                    ❌ Your listing was rejected. Edit and resubmit for review.
                  </div>
                )}

                <div className={styles.listingActions}>
                  <button className={styles.editBtn} onClick={() => openEdit(b)}>✏️ Edit</button>
                  <button className={styles.deleteBtn} onClick={() => setDeleting(b)}>🗑️ Delete</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Edit Modal ── */}
      {editing && (
        <div className={styles.overlay} onClick={() => !saving && setEditing(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>✏️ Edit Listing</div>
              <button className={styles.modalClose} onClick={() => !saving && setEditing(null)}>✕</button>
            </div>

            <div className={styles.modalNote}>
              ⚠️ After saving, your listing will be set to <b>Under Review</b> until admin approves.
            </div>

            <div className={styles.modalBody}>

              {/* Category */}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Category *</label>
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

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Business Name *</label>
                <input className={styles.input} value={form.name ?? ""} onChange={e => set("name", e.target.value)} />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Description</label>
                <textarea className={styles.input} rows={3} value={form.description ?? ""} onChange={e => set("description", e.target.value)} />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Phone</label>
                <input className={styles.input} type="tel" value={form.phone ?? ""} onChange={e => set("phone", e.target.value)} />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Website</label>
                <input className={styles.input} type="url" value={form.website ?? ""} onChange={e => set("website", e.target.value)} />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Pi Wallet Address</label>
                <input className={styles.input} value={form.pi_wallet ?? ""} onChange={e => set("pi_wallet", e.target.value)} />
              </div>

              {/* Photos */}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Photos</label>
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
                      <span className={styles.photoAddLabel}>Add</span>
                    </button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleImagePick} />
              </div>

              {/* Location */}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Address *</label>
                <input className={styles.input} value={form.address ?? ""} onChange={e => set("address", e.target.value)} />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>City *</label>
                <input className={styles.input} value={form.city ?? ""} onChange={e => set("city", e.target.value)} />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>State</label>
                <input className={styles.input} value={form.state ?? ""} onChange={e => set("state", e.target.value)} />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Country</label>
                <input className={styles.input} value={form.country ?? ""} onChange={e => set("country", e.target.value)} />
              </div>

              {/* Opening Hours */}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>🕐 Opening Hours</label>
                <div className={styles.hoursGrid}>
                  {openingHours.map((h) => (
                    <div key={h.day} className={styles.hoursRow}>
                      <div className={styles.hoursDay}>{h.day}</div>
                      <input
                        className={styles.input}
                        placeholder="e.g. 9am - 5pm, Closed"
                        value={h.time}
                        onChange={e => setOpenTime(h.day, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.gpsBox}>
                <div className={styles.gpsTitle}>GPS Coordinates</div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Latitude</label>
                  <input className={styles.input} value={form.lat ?? ""} onChange={e => set("lat", e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Longitude</label>
                  <input className={styles.input} value={form.lng ?? ""} onChange={e => set("lng", e.target.value)} />
                </div>
                <button type="button" className={styles.gpsBtn} onClick={handleLocate} disabled={locating}>
                  {locating ? "⏳ Detecting..." : "🎯 Use My Location"}
                </button>
              </div>

              {msg && (
                <div className={`${styles.msg} ${msg.startsWith("✅") ? styles.msgSuccess : styles.msgError}`}>
                  {msg}
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving || uploading}>
                {uploading ? "⏳ Uploading..." : saving ? "Saving..." : "💾 Save & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleting && (
        <div className={styles.overlay} onClick={() => !deletingId && setDeleting(null)}>
          <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmIcon}>🗑️</div>
            <div className={styles.confirmTitle}>Delete Listing?</div>
            <div className={styles.confirmSub}>
              <b>{deleting.name}</b> will be permanently removed. This cannot be undone.
            </div>
            <div className={styles.confirmBtns}>
              <button className={styles.cancelBtn} onClick={() => setDeleting(null)} disabled={deletingId}>Cancel</button>
              <button className={styles.deleteConfirmBtn} onClick={handleDelete} disabled={deletingId}>
                {deletingId ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}