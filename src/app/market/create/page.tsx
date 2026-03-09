"use client";
export const dynamic = "force-dynamic";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { CATEGORIES, CONDITIONS, BUYING_METHODS } from "@/lib/market/categories";
import { ALL_COUNTRIES, getCountry } from "@/lib/market/countries";
import styles from "./page.module.css";

const MAX_IMAGES = 5;

function CountrySelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = ALL_COUNTRIES.filter(c =>
    c.code !== "WORLDWIDE" && (
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase())
    )
  );
  const selected = getCountry(value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className={styles.countrySelect}>
      <button type="button" className={styles.input} style={{ textAlign: "left", cursor: "pointer" }} onClick={() => setOpen(p => !p)}>
        {selected.flag} {selected.name} ▾
      </button>
      {open && (
        <div className={styles.countryDropdown}>
          <input
            className={styles.countrySearch}
            placeholder="Search country..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <div className={styles.countryList}>
            {filtered.map(c => (
              <button
                key={c.code}
                type="button"
                className={`${styles.countryOption} ${value === c.code ? styles.countryOptionActive : ""}`}
                onClick={() => { onChange(c.code); setOpen(false); setSearch(""); }}
              >
                {c.flag} {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreateListingPage() {
  const { user } = useAuth();
  const router   = useRouter();
  const fileRef  = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "", description: "", price_pi: "",
    category: "", subcategory: "", condition: "new",
    buying_method: "both", location: "", stock: "1", type: "physical",
  });
  const [countryCode, setCountryCode]     = useState("MY");
  const [shipWorldwide, setShipWorldwide] = useState(false);
  const [images, setImages]               = useState<string[]>([]);
  const [uploading, setUploading]         = useState(false);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState("");
  const [step, setStep]                   = useState<"details" | "images" | "preview">("details");

  const selectedCat = CATEGORIES.find(c => c.id === form.category);

  useEffect(() => {
    fetch("/api/geo").then(r => r.json()).then(d => {
      if (d.success) setCountryCode(d.data.code);
    }).catch(() => {});
  }, []);

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleImageUpload = async (files: FileList | null) => {
    if (!files) return;
    if (images.length + files.length > MAX_IMAGES) { setError(`Max ${MAX_IMAGES} images`); return; }
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    setUploading(true); setError("");
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fd   = new FormData();
      fd.append("image", file);
      fd.append("index", String(images.length + i));
      try {
        const r = await fetch("/api/market/images", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
        const d = await r.json();
        if (d.success) setImages(prev => [...prev, d.data.url]);
        else setError(d.error ?? "Upload failed");
      } catch { setError("Upload failed"); }
    }
    setUploading(false);
  };

  const removeImage = (i: number) => setImages(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!form.title || !form.price_pi || !form.category) { setError("Fill in required fields"); return; }
    if (parseFloat(form.price_pi) <= 0) { setError("Price must be greater than 0"); return; }
    const token = localStorage.getItem("supapi_token");
    if (!token) { router.push("/dashboard"); return; }
    setSaving(true); setError("");
    try {
      const r = await fetch("/api/market/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          price_pi: parseFloat(form.price_pi),
          stock: parseInt(form.stock),
          images,
          country_code: countryCode,
          ship_worldwide: shipWorldwide,
        }),
      });
      const d = await r.json();
      if (d.success) router.push(`/market/${d.data.id}`);
      else setError(d.error ?? "Failed to create listing");
    } catch { setError("Something went wrong"); }
    setSaving(false);
  };

  if (!user) return (
    <div className={styles.authWall}>
      <div className={styles.authIcon}>🔒</div>
      <div className={styles.authTitle}>Sign in to sell</div>
      <button className={styles.authBtn} onClick={() => router.push("/dashboard")}>Sign In with Pi</button>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>← Back</button>
        <h1 className={styles.title}>Create Listing</h1>
        <div />
      </div>

      <div className={styles.steps}>
        {["details", "images", "preview"].map((s, i) => (
          <button key={s} className={`${styles.step} ${step === s ? styles.stepActive : ""} ${["details","images","preview"].indexOf(step) > i ? styles.stepDone : ""}`}
            onClick={() => setStep(s as any)}>
            <span className={styles.stepNum}>{["details","images","preview"].indexOf(step) > i ? "✓" : i + 1}</span>
            <span className={styles.stepLabel}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
          </button>
        ))}
      </div>

      <div className={styles.body}>

        {step === "details" && (
          <div className={styles.form}>
            <div className={styles.formField}>
              <label className={styles.label}>Title <span className={styles.req}>*</span></label>
              <input className={styles.input} placeholder="What are you selling?" maxLength={100}
                value={form.title} onChange={e => set("title", e.target.value)} />
              <div className={styles.charCount}>{form.title.length}/100</div>
            </div>

            <div className={styles.formField}>
              <label className={styles.label}>Category <span className={styles.req}>*</span></label>
              <select className={styles.input} value={form.category} onChange={e => { set("category", e.target.value); set("subcategory", ""); }}>
                <option value="">Select category...</option>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>
            </div>

            {selectedCat && selectedCat.subcategories.length > 1 && (
              <div className={styles.formField}>
                <label className={styles.label}>Subcategory</label>
                <select className={styles.input} value={form.subcategory} onChange={e => set("subcategory", e.target.value)}>
                  <option value="">Select subcategory...</option>
                  {selectedCat.subcategories.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            )}

            <div className={styles.row}>
              <div className={styles.formField}>
                <label className={styles.label}>Price (π) <span className={styles.req}>*</span></label>
                <input className={styles.input} type="number" min="0" step="0.01" placeholder="0.00"
                  value={form.price_pi} onChange={e => set("price_pi", e.target.value)} />
              </div>
              <div className={styles.formField}>
                <label className={styles.label}>Stock</label>
                <input className={styles.input} type="number" min="1" placeholder="1"
                  value={form.stock} onChange={e => set("stock", e.target.value)} />
              </div>
            </div>

            <div className={styles.formField}>
              <label className={styles.label}>Condition</label>
              <div className={styles.optionGrid}>
                {CONDITIONS.map(c => (
                  <button key={c.id} type="button" className={`${styles.optBtn} ${form.condition === c.id ? styles.optBtnActive : ""}`}
                    onClick={() => set("condition", c.id)}>{c.label}</button>
                ))}
              </div>
            </div>

            <div className={styles.formField}>
              <label className={styles.label}>Buying Method</label>
              <div className={styles.optionGrid}>
                {BUYING_METHODS.map(m => (
                  <button key={m.id} type="button" className={`${styles.optBtn} ${form.buying_method === m.id ? styles.optBtnActive : ""}`}
                    onClick={() => set("buying_method", m.id)}>{m.emoji} {m.label}</button>
                ))}
              </div>
            </div>

            <div className={styles.formField}>
              <label className={styles.label}>Location</label>
              <input className={styles.input} placeholder="e.g. Kuala Lumpur, Selangor"
                value={form.location} onChange={e => set("location", e.target.value)} />
            </div>

            <div className={styles.formField}>
              <label className={styles.label}>Your Country</label>
              <CountrySelect value={countryCode} onChange={setCountryCode} />
            </div>

            <div className={styles.formField}>
              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>🌍 Ship Worldwide</div>
                  <div className={styles.toggleSub}>Allow buyers from other countries to purchase</div>
                </div>
                <button
                  type="button"
                  className={`${styles.toggle} ${shipWorldwide ? styles.toggleOn : ""}`}
                  onClick={() => setShipWorldwide(p => !p)}
                >
                  {shipWorldwide ? "ON" : "OFF"}
                </button>
              </div>
            </div>

            <div className={styles.formField}>
              <label className={styles.label}>Description</label>
              <textarea className={styles.input} rows={4} placeholder="Describe your item — condition, brand, specs, reason for selling..."
                value={form.description} onChange={e => set("description", e.target.value)} />
            </div>

            {error && <div className={styles.error}>{error}</div>}
            <button className={styles.nextBtn} onClick={() => {
              if (!form.title || !form.category) { setError("Title and category are required"); return; }
              setError(""); setStep("images");
            }}>Next: Add Photos →</button>
          </div>
        )}

        {step === "images" && (
          <div className={styles.form}>
            <div className={styles.imgHeader}>
              <div className={styles.imgTitle}>Product Photos</div>
              <div className={styles.imgSub}>{images.length}/{MAX_IMAGES} photos · First photo is cover</div>
            </div>
            <div className={styles.imgGrid}>
              {images.map((url, i) => (
                <div key={i} className={styles.imgItem}>
                  <img src={url} alt="" className={styles.imgPreview} />
                  {i === 0 && <div className={styles.coverBadge}>Cover</div>}
                  <button className={styles.removeImg} onClick={() => removeImage(i)}>✕</button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <button className={styles.addImg} onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? "⏳" : "📷"}
                  <span>{uploading ? "Uploading..." : "Add Photo"}</span>
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden
              onChange={e => handleImageUpload(e.target.files)} />
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.btnRow}>
              <button className={styles.prevBtn} onClick={() => setStep("details")}>← Back</button>
              <button className={styles.nextBtn} onClick={() => { setError(""); setStep("preview"); }}>Preview Listing →</button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className={styles.form}>
            <div className={styles.previewCard}>
              <div className={styles.previewImg}>
                {images[0] ? <img src={images[0]} alt="" className={styles.previewImgEl} /> : <div className={styles.previewImgPlaceholder}>🛍️</div>}
              </div>
              <div className={styles.previewBody}>
                <div className={styles.previewTitle}>{form.title}</div>
                <div className={styles.previewPrice}>{parseFloat(form.price_pi || "0").toFixed(2)} π</div>
                <div className={styles.previewTags}>
                  <span className={styles.tag}>{CONDITIONS.find(c=>c.id===form.condition)?.label}</span>
                  <span className={styles.tag}>{BUYING_METHODS.find(m=>m.id===form.buying_method)?.emoji} {BUYING_METHODS.find(m=>m.id===form.buying_method)?.label}</span>
                  {form.location && <span className={styles.tag}>📍 {form.location}</span>}
                  <span className={styles.tag}>{getCountry(countryCode).flag} {getCountry(countryCode).name}</span>
                  {shipWorldwide && <span className={styles.tag}>🌍 Ships Worldwide</span>}
                </div>
                {form.description && <div className={styles.previewDesc}>{form.description}</div>}
              </div>
            </div>
            {images.length > 1 && (
              <div className={styles.previewImgRow}>
                {images.slice(1).map((url, i) => (
                  <img key={i} src={url} alt="" className={styles.previewThumb} />
                ))}
              </div>
            )}
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.btnRow}>
              <button className={styles.prevBtn} onClick={() => setStep("images")}>← Back</button>
              <button className={styles.publishBtn} onClick={handleSubmit} disabled={saving}>
                {saving ? "Publishing..." : "🚀 Publish Listing"}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}