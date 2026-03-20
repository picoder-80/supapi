"use client";
export const dynamic = "force-dynamic";

import { useState, useRef, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { CATEGORIES, CONDITIONS, BUYING_METHODS, getSubcategory } from "@/lib/market/categories";
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
      <button type="button" className={`${styles.input} ${styles.countryTrigger}`} onClick={() => setOpen(p => !p)}>
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

export default function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "", description: "", price_pi: "",
    category: "", subcategory: "", category_deep: "", condition: "new",
    buying_method: "both", location: "", stock: "1", type: "physical",
  });
  const [countryCode, setCountryCode] = useState("MY");
  const [shipWorldwide, setShipWorldwide] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"details" | "images" | "preview">("details");
  const [notFound, setNotFound] = useState(false);
  const [notOwner, setNotOwner] = useState(false);

  const selectedCat = CATEGORIES.find(c => c.id === form.category);
  const selectedSub = form.category && form.subcategory ? getSubcategory(form.category, form.subcategory) : undefined;
  const parsedPrice = parseFloat(form.price_pi || "0");
  const safePrice = Number.isFinite(parsedPrice) ? parsedPrice : 0;

  useEffect(() => {
    const fetch_ = async () => {
      const token = localStorage.getItem("supapi_token");
      if (!token) { setLoading(false); return; }
      try {
        const r = await fetch(`/api/supamarket/listings/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (!d.success || !d.data) { setNotFound(true); return; }
        const l = d.data;
        if (l.seller_id !== user?.id && l.seller?.id !== user?.id) { setNotOwner(true); return; }
        if (!["active", "paused"].includes(l.status)) {
          setError("Only active or paused listings can be edited.");
          setLoading(false);
          return;
        }
        setForm({
          title: l.title ?? "",
          description: l.description ?? "",
          price_pi: String(l.price_pi ?? ""),
          category: l.category ?? "",
          subcategory: l.subcategory ?? "",
          category_deep: typeof l.category_deep === "string" ? l.category_deep : "",
          condition: l.condition ?? "new",
          buying_method: l.buying_method ?? "both",
          location: l.location ?? "",
          stock: String(l.stock ?? 1),
          type: l.type ?? "physical",
        });
        setCountryCode(l.country_code ?? "US");
        setShipWorldwide(Boolean(l.ship_worldwide));
        setImages(Array.isArray(l.images) ? l.images : []);
      } catch { setNotFound(true); }
      setLoading(false);
    };
    if (user) fetch_();
    else setLoading(false);
  }, [id, user]);

  useEffect(() => {
    const cat = CATEGORIES.find((c) => c.id === form.category);
    if (!cat?.subcategories.length) return;
    if (cat.subcategories.length === 1) {
      const only = cat.subcategories[0].id;
      setForm((f) =>
        f.subcategory === only ? f : { ...f, subcategory: only, category_deep: "" }
      );
    }
  }, [form.category]);

  useEffect(() => {
    const sub =
      form.category && form.subcategory ? getSubcategory(form.category, form.subcategory) : undefined;
    if (!sub?.deep.length) {
      setForm((f) => (f.category_deep ? { ...f, category_deep: "" } : f));
      return;
    }
    if (sub.deep.length === 1) {
      const only = sub.deep[0].id;
      setForm((f) => (f.category_deep === only ? f : { ...f, category_deep: only }));
      return;
    }
    setForm((f) => {
      if (!f.category_deep || sub.deep.some((d) => d.id === f.category_deep)) return f;
      return { ...f, category_deep: "" };
    });
  }, [form.category, form.subcategory]);

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleImageUpload = async (files: FileList | null) => {
    if (!files) return;
    if (images.length + files.length > MAX_IMAGES) { setError(`Max ${MAX_IMAGES} images`); return; }
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    setUploading(true); setError("");
    const uploaded: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fd = new FormData();
      fd.append("image", file);
      fd.append("index", String(images.length + uploaded.length));
      try {
        const r = await fetch("/api/supamarket/images", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
        const d = await r.json();
        if (d.success) uploaded.push(d.data.url);
        else setError(d.error ?? "Upload failed");
      } catch { setError("Upload failed"); }
    }
    if (uploaded.length) setImages(prev => [...prev, ...uploaded]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (i: number) => setImages(prev => prev.filter((_, idx) => idx !== i));

  const validateCategoryPath = (): string | null => {
    if (!form.category) return "Choose a category";
    const cat = CATEGORIES.find((c) => c.id === form.category);
    if (cat && cat.subcategories.length > 0 && !form.subcategory) return "Choose a subcategory";
    const sub = form.category && form.subcategory ? getSubcategory(form.category, form.subcategory) : undefined;
    if (sub && sub.deep.length > 1 && !form.category_deep) return "Choose a type";
    return null;
  };

  const handleSubmit = async () => {
    const catErr = validateCategoryPath();
    if (catErr) { setError(catErr); return; }
    if (!form.title || !form.price_pi || !form.category) { setError("Fill in required fields"); return; }
    if (parseFloat(form.price_pi) <= 0) { setError("Price must be greater than 0"); return; }
    const token = localStorage.getItem("supapi_token");
    if (!token) { router.push("/dashboard"); return; }
    setSaving(true); setError("");
    try {
      const r = await fetch(`/api/supamarket/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          category_deep: form.category_deep || "",
          price_pi: parseFloat(form.price_pi),
          stock: Math.max(1, parseInt(form.stock, 10) || 1),
          images,
          country_code: countryCode,
          ship_worldwide: shipWorldwide,
        }),
      });
      const d = await r.json();
      if (d.success) router.push(`/supamarket/${id}`);
      else setError(d.error ?? "Failed to update listing");
    } catch { setError("Something went wrong"); }
    setSaving(false);
  };

  const goNextFromDetails = () => {
    const catErr = validateCategoryPath();
    if (!form.title || !form.category) { setError("Title and category are required"); return; }
    if (catErr) { setError(catErr); return; }
    setError("");
    setStep("images");
  };

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Edit Listing", url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // user cancelled share flow
    }
  };

  const renderTopBar = () => (
    <header className={styles.topBar}>
      <button className={styles.iconBtn} onClick={() => router.back()} aria-label="Go back">←</button>
      <h1 className={styles.title}>Edit Listing</h1>
      <button className={styles.iconBtn} onClick={handleShare} aria-label="Share">⤴</button>
    </header>
  );

  if (!user) return (
    <div className={styles.page}>
      {renderTopBar()}
      <div className={styles.stateWrap}>
        <div className={styles.stateCard}>
          <div className={styles.stateIcon}>🔒</div>
          <div className={styles.stateTitle}>Sign in to edit</div>
          <div className={styles.stateText}>Sign in with Pi to manage your listing details.</div>
          <button className={styles.authBtn} onClick={() => router.push("/dashboard")}>Sign In with Pi</button>
        </div>
      </div>
    </div>
  );

  if (loading) return (
    <div className={styles.page}>
      {renderTopBar()}
      <div className={styles.layout}>
        <div className={styles.leftCol}>
          <div className={styles.skeletonCard}>
            <div className={styles.skeletonLineLg} />
            <div className={styles.skeletonSteps}>
              <div className={styles.skeletonPill} />
              <div className={styles.skeletonPill} />
              <div className={styles.skeletonPill} />
            </div>
          </div>
          <div className={styles.skeletonCard}>
            <div className={styles.skeletonLine} />
            <div className={styles.skeletonInput} />
            <div className={styles.skeletonInput} />
            <div className={styles.skeletonInput} />
            <div className={styles.skeletonBtn} />
          </div>
        </div>
        <div className={styles.rightCol}>
          <div className={styles.skeletonCard}>
            <div className={styles.skeletonLine} />
            <div className={styles.skeletonLine} />
          </div>
        </div>
      </div>
    </div>
  );

  if (notFound) return (
    <div className={styles.page}>
      {renderTopBar()}
      <div className={styles.stateWrap}>
        <div className={styles.stateCard}>
          <div className={styles.stateIcon}>🔍</div>
          <div className={styles.stateTitle}>Listing not found</div>
          <div className={styles.stateText}>This listing may have been removed or is unavailable.</div>
          <Link href="/supamarket/my-listings" className={styles.linkBtn}>← My Listings</Link>
        </div>
      </div>
    </div>
  );

  if (notOwner) return (
    <div className={styles.page}>
      {renderTopBar()}
      <div className={styles.stateWrap}>
        <div className={styles.stateCard}>
          <div className={styles.stateIcon}>🚫</div>
          <div className={styles.stateTitle}>You can only edit your own listings</div>
          <div className={styles.stateText}>Switch to a listing owned by your account to continue.</div>
          <Link href="/supamarket/my-listings" className={styles.linkBtn}>← My Listings</Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      {renderTopBar()}

      <div className={styles.layout}>
        <div className={styles.leftCol}>
          <div className={styles.steps}>
            {["details", "images", "preview"].map((s, i) => (
              <button key={s} className={`${styles.step} ${step === s ? styles.stepActive : ""} ${["details", "images", "preview"].indexOf(step) > i ? styles.stepDone : ""}`}
                onClick={() => setStep(s as "details" | "images" | "preview")}>
                <span className={styles.stepNum}>{["details", "images", "preview"].indexOf(step) > i ? "✓" : i + 1}</span>
                <span className={styles.stepLabel}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
              </button>
            ))}
          </div>

          <div className={styles.body}>
            {step === "details" && (
              <div className={`${styles.formCard} ${styles.form}`}>
                <div className={styles.formField}>
                  <label className={styles.label}>Title <span className={styles.req}>*</span></label>
                  <input className={styles.input} placeholder="What are you selling?" maxLength={100}
                    value={form.title} onChange={e => set("title", e.target.value)} />
                  <div className={styles.charCount}>{form.title.length}/100</div>
                </div>

                <div className={styles.formField}>
                  <label className={styles.label}>Category <span className={styles.req}>*</span></label>
                  <select className={styles.input} value={form.category} onChange={e => {
                    setForm((prev) => ({ ...prev, category: e.target.value, subcategory: "", category_deep: "" }));
                  }}>
                    <option value="">Select category...</option>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                  </select>
                </div>

                {selectedCat && selectedCat.subcategories.length > 1 && (
                  <div className={styles.formField}>
                    <label className={styles.label}>Subcategory <span className={styles.req}>*</span></label>
                    <select className={styles.input} value={form.subcategory} onChange={e => {
                      setForm((prev) => ({ ...prev, subcategory: e.target.value, category_deep: "" }));
                    }}>
                      <option value="">Select subcategory...</option>
                      {selectedCat.subcategories.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                )}

                {selectedSub && selectedSub.deep.length > 1 && (
                  <div className={styles.formField}>
                    <label className={styles.label}>Type <span className={styles.req}>*</span></label>
                    <select className={styles.input} value={form.category_deep} onChange={e => set("category_deep", e.target.value)}>
                      <option value="">Select type...</option>
                      {selectedSub.deep.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
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
                  <input className={styles.input} placeholder="e.g. Los Angeles, California"
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
                <button className={`${styles.nextBtn} ${styles.nextBtnBlock}`} onClick={goNextFromDetails}>Next: Photos →</button>
              </div>
            )}

            {step === "images" && (
              <div className={`${styles.formCard} ${styles.form}`}>
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
                  <button className={styles.nextBtn} onClick={() => { setError(""); setStep("preview"); }}>Preview →</button>
                </div>
              </div>
            )}

            {step === "preview" && (
              <div className={styles.previewLayout}>
                <div className={styles.previewCard}>
                  <div className={styles.previewImg}>
                    {images[0] ? <img src={images[0]} alt="" className={styles.previewImgEl} /> : <div className={styles.previewImgPlaceholder}>🛍️</div>}
                  </div>
                  <div className={styles.previewBody}>
                    <div className={styles.previewTitle}>{form.title}</div>
                    <div className={styles.previewPrice}>{safePrice.toFixed(2)} π</div>
                    <div className={styles.escrowBanner}>π Pi held in escrow until you confirm delivery</div>
                    <div className={styles.previewTags}>
                      <span className={styles.tag}>{CONDITIONS.find(c => c.id === form.condition)?.label}</span>
                      <span className={styles.tag}>{BUYING_METHODS.find(m => m.id === form.buying_method)?.emoji} {BUYING_METHODS.find(m => m.id === form.buying_method)?.label}</span>
                      {form.location && <span className={styles.tag}>📍 {form.location}</span>}
                      <span className={styles.tag}>{getCountry(countryCode).flag} {getCountry(countryCode).name}</span>
                      {shipWorldwide && <span className={styles.tag}>🌍 Ships Worldwide</span>}
                    </div>
                    {form.description && <div className={styles.previewDesc}>{form.description}</div>}
                  </div>
                </div>
                <div className={styles.previewSide}>
                  {images.length > 1 && (
                    <div className={styles.previewGalleryCard}>
                      <div className={styles.previewImgRow}>
                        {images.slice(1).map((url, i) => (
                          <img key={i} src={url} alt="" className={styles.previewThumb} />
                        ))}
                      </div>
                    </div>
                  )}
                  {error && <div className={styles.error}>{error}</div>}
                  <div className={styles.btnRow}>
                    <button className={styles.prevBtn} onClick={() => setStep("images")}>← Back</button>
                    <button className={styles.publishBtn} onClick={handleSubmit} disabled={saving}>
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className={styles.rightCol}>
          <div className={styles.infoCard}>
            <div className={styles.infoTitle}>Edit checklist</div>
            <ul className={styles.infoList}>
              <li>Keep title and category clear</li>
              <li>Use a strong cover photo</li>
              <li>Set realistic stock and pricing</li>
            </ul>
          </div>
          <div className={styles.infoCard}>
            <div className={styles.infoTitle}>Current value</div>
            <div className={styles.infoPrice}>{safePrice.toFixed(2)} π</div>
            <div className={styles.infoText}>This preview reflects how your listing appears to buyers.</div>
          </div>
        </aside>
      </div>

      <div className={styles.stickyBottomBar}>
        <div className={styles.stickyPriceWrap}>
          <div className={styles.stickyLabel}>Current price</div>
          <div className={styles.stickyPrice}>{safePrice.toFixed(2)} π</div>
        </div>
        {step === "details" && (
          <button className={styles.stickyBuyBtn} onClick={goNextFromDetails}>Next: Photos</button>
        )}
        {step === "images" && (
          <button className={styles.stickyBuyBtn} onClick={() => { setError(""); setStep("preview"); }}>Preview</button>
        )}
        {step === "preview" && (
          <button className={styles.stickyBuyBtn} onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        )}
      </div>
    </div>
  );
}
