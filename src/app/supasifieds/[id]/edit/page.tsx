"use client";
export const dynamic = "force-dynamic";

import { useState, useRef, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { CATEGORIES, getSubcategory } from "@/lib/supasifieds/categories";
import { formatPiPriceDisplay } from "@/lib/supasifieds/price";
import { ALL_COUNTRIES, getCountry } from "@/lib/market/countries";
import styles from "../../../supamarket/[id]/edit/page.module.css";

const MAX_IMAGES = 5;

function CountrySelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = ALL_COUNTRIES.filter(
    (c) =>
      c.code !== "WORLDWIDE" &&
      (c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()))
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
      <button type="button" className={`${styles.input} ${styles.countryTrigger}`} onClick={() => setOpen((p) => !p)}>
        {selected.flag} {selected.name} ▾
      </button>
      {open && (
        <div className={styles.countryDropdown}>
          <input
            className={styles.countrySearch}
            placeholder="Search country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className={styles.countryList}>
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                className={`${styles.countryOption} ${value === c.code ? styles.countryOptionActive : ""}`}
                onClick={() => {
                  onChange(c.code);
                  setOpen(false);
                  setSearch("");
                }}
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

export default function SupasifiedsEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price_display: "",
    category: "",
    subcategory: "",
    category_deep: "",
    location: "",
    contact_phone: "",
    contact_whatsapp: "",
  });
  const [countryCode, setCountryCode] = useState("MY");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"details" | "images" | "preview">("details");
  const [notFound, setNotFound] = useState(false);
  const [notOwner, setNotOwner] = useState(false);

  const selectedCat = CATEGORIES.find((c) => c.id === form.category);
  const selectedSub = form.category && form.subcategory ? getSubcategory(form.category, form.subcategory) : undefined;

  useEffect(() => {
    const cat = CATEGORIES.find((c) => c.id === form.category);
    if (!cat?.subcategories.length) return;
    if (cat.subcategories.length === 1) {
      const only = cat.subcategories[0].id;
      setForm((f) => (f.subcategory === only ? f : { ...f, subcategory: only, category_deep: "" }));
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

  useEffect(() => {
    const fetch_ = async () => {
      const token = localStorage.getItem("supapi_token");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const r = await fetch(`/api/supasifieds/listings/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (!d.success || !d.data) {
          setNotFound(true);
          return;
        }
        const l = d.data;
        if (l.seller_id !== user?.id && l.seller?.id !== user?.id) {
          setNotOwner(true);
          return;
        }
        if (!["active", "paused"].includes(l.status)) {
          setError("Only active or paused ads can be edited.");
          setLoading(false);
          return;
        }
        setForm({
          title: l.title ?? "",
          description: l.description ?? "",
          price_display: l.price_display ?? "",
          category: l.category ?? "",
          subcategory: l.subcategory ?? "",
          category_deep: typeof l.category_deep === "string" ? l.category_deep : "",
          location: l.location ?? "",
          contact_phone: l.contact_phone ?? "",
          contact_whatsapp: l.contact_whatsapp ?? "",
        });
        setCountryCode(l.country_code ?? "MY");
        setImages(Array.isArray(l.images) ? l.images : []);
      } catch {
        setNotFound(true);
      }
      setLoading(false);
    };
    if (user) fetch_();
    else setLoading(false);
  }, [id, user]);

  const set = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleImageUpload = async (files: FileList | null) => {
    if (!files) return;
    if (images.length + files.length > MAX_IMAGES) {
      setError(`Max ${MAX_IMAGES} images`);
      return;
    }
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    setUploading(true);
    setError("");
    const uploaded: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fd = new FormData();
      fd.append("image", file);
      fd.append("classified_id", id);
      fd.append("index", String(images.length + uploaded.length));
      try {
        const r = await fetch("/api/supasifieds/images", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const d = await r.json();
        if (d.success) uploaded.push(d.data.url);
        else setError(d.error ?? "Upload failed");
      } catch {
        setError("Upload failed");
      }
    }
    if (uploaded.length) setImages((prev) => [...prev, ...uploaded]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (i: number) => setImages((prev) => prev.filter((_, idx) => idx !== i));

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
    if (catErr) {
      setError(catErr);
      return;
    }
    if (!form.title || !form.category) {
      setError("Title and category are required");
      return;
    }
    const token = localStorage.getItem("supapi_token");
    if (!token) {
      router.push("/dashboard");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const r = await fetch(`/api/supasifieds/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          price_display: form.price_display || null,
          category: form.category,
          subcategory: form.subcategory,
          category_deep: form.category_deep || "",
          images,
          location: form.location,
          country_code: countryCode,
          contact_phone: form.contact_phone || null,
          contact_whatsapp: form.contact_whatsapp || null,
        }),
      });
      const d = await r.json();
      if (d.success) router.push(`/supasifieds/${id}`);
      else setError(d.error ?? "Failed to save");
    } catch {
      setError("Something went wrong");
    }
    setSaving(false);
  };

  const goNextFromDetails = () => {
    const catErr = validateCategoryPath();
    if (!form.title || !form.category) {
      setError("Title and category are required");
      return;
    }
    if (catErr) {
      setError(catErr);
      return;
    }
    setError("");
    setStep("images");
  };

  const renderTopBar = () => (
    <header className={styles.topBar}>
      <button type="button" className={styles.iconBtn} onClick={() => router.back()} aria-label="Back">
        ←
      </button>
        <h1 className={styles.title}>Edit ad</h1>
      <span className={styles.iconBtn} />
    </header>
  );

  if (!user) {
    return (
      <div className={styles.page}>
        {renderTopBar()}
        <div className={styles.stateWrap}>
          <div className={styles.stateCard}>
            <div className={styles.stateIcon}>🔒</div>
            <div className={styles.stateTitle}>Sign in</div>
            <button type="button" className={styles.authBtn} onClick={() => router.push("/dashboard")}>
              Sign In with Pi
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.page}>
        {renderTopBar()}
        <div className={styles.layout}>
          <div className={styles.skeletonCard} style={{ minHeight: 200 }} />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className={styles.page}>
        {renderTopBar()}
        <div className={styles.stateWrap}>
          <div className={styles.stateCard}>
            <div className={styles.stateIcon}>🔍</div>
            <div className={styles.stateTitle}>Not found</div>
            <Link href="/supasifieds/my-listings" className={styles.linkBtn}>
              ← My ads
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (notOwner) {
    return (
      <div className={styles.page}>
        {renderTopBar()}
        <div className={styles.stateWrap}>
          <div className={styles.stateCard}>
            <div className={styles.stateIcon}>🚫</div>
            <div className={styles.stateTitle}>Not your ad</div>
            <Link href="/supasifieds/my-listings" className={styles.linkBtn}>
              ← My ads
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {renderTopBar()}

      <div className={styles.layout}>
        <div className={styles.leftCol}>
          <div className={styles.steps}>
            {(["details", "images", "preview"] as const).map((s, i) => (
              <button
                key={s}
                type="button"
                className={`${styles.step} ${step === s ? styles.stepActive : ""} ${(["details", "images", "preview"].indexOf(step) > i ? styles.stepDone : "")}`}
                onClick={() => setStep(s)}
              >
                <span className={styles.stepNum}>{["details", "images", "preview"].indexOf(step) > i ? "✓" : i + 1}</span>
                <span className={styles.stepLabel}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
              </button>
            ))}
          </div>

          <div className={styles.body}>
            {step === "details" && (
              <div className={`${styles.formCard} ${styles.form}`}>
                <div className={styles.formField}>
                  <label className={styles.label}>
                    Title <span className={styles.req}>*</span>
                  </label>
                  <input
                    className={styles.input}
                    maxLength={100}
                    value={form.title}
                    onChange={(e) => set("title", e.target.value)}
                  />
                  <div className={styles.charCount}>{form.title.length}/100</div>
                </div>

                <div className={styles.formField}>
                  <label className={styles.label}>
                    Category <span className={styles.req}>*</span>
                  </label>
                  <select
                    className={styles.input}
                    value={form.category}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, category: e.target.value, subcategory: "", category_deep: "" }))
                    }
                  >
                    <option value="">Select...</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCat && selectedCat.subcategories.length > 1 && (
                  <div className={styles.formField}>
                    <label className={styles.label}>
                      Subcategory <span className={styles.req}>*</span>
                    </label>
                    <select
                      className={styles.input}
                      value={form.subcategory}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, subcategory: e.target.value, category_deep: "" }))
                      }
                    >
                      <option value="">Select...</option>
                      {selectedCat.subcategories.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedSub && selectedSub.deep.length > 1 && (
                  <div className={styles.formField}>
                    <label className={styles.label}>
                      Type <span className={styles.req}>*</span>
                    </label>
                    <select
                      className={styles.input}
                      value={form.category_deep}
                      onChange={(e) => set("category_deep", e.target.value)}
                    >
                      <option value="">Select...</option>
                      {selectedSub.deep.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={styles.formField}>
                  <label className={styles.label}>
                    Price (π) <span className={styles.req}>*</span>
                  </label>
                  <input
                    className={styles.input}
                    placeholder="e.g. 25 π, Negotiable, Free"
                    value={form.price_display}
                    onChange={(e) => set("price_display", e.target.value)}
                  />
                </div>

                <div className={styles.formField}>
                  <label className={styles.label}>Location</label>
                  <input className={styles.input} value={form.location} onChange={(e) => set("location", e.target.value)} />
                </div>

                <div className={styles.formField}>
                  <label className={styles.label}>Country</label>
                  <CountrySelect value={countryCode} onChange={setCountryCode} />
                </div>

                <div className={styles.row}>
                  <div className={styles.formField}>
                    <label className={styles.label}>Phone</label>
                    <input className={styles.input} value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.label}>WhatsApp</label>
                    <input className={styles.input} value={form.contact_whatsapp} onChange={(e) => set("contact_whatsapp", e.target.value)} />
                  </div>
                </div>

                <div className={styles.formField}>
                  <label className={styles.label}>Description</label>
                  <textarea className={styles.input} rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} />
                </div>

                {error && <div className={styles.error}>{error}</div>}
                <button type="button" className={`${styles.nextBtn} ${styles.nextBtnBlock}`} onClick={goNextFromDetails}>
                  Next: Photos →
                </button>
              </div>
            )}

            {step === "images" && (
              <div className={`${styles.formCard} ${styles.form}`}>
                <div className={styles.imgHeader}>
                  <div className={styles.imgTitle}>Photos</div>
                  <div className={styles.imgSub}>
                    {images.length}/{MAX_IMAGES}
                  </div>
                </div>
                <div className={styles.imgGrid}>
                  {images.map((url, i) => (
                    <div key={i} className={styles.imgItem}>
                      <img src={url} alt="" className={styles.imgPreview} />
                      {i === 0 && <div className={styles.coverBadge}>Cover</div>}
                      <button type="button" className={styles.removeImg} onClick={() => removeImage(i)}>
                        ✕
                      </button>
                    </div>
                  ))}
                  {images.length < MAX_IMAGES && (
                    <button type="button" className={styles.addImg} onClick={() => fileRef.current?.click()} disabled={uploading}>
                      {uploading ? "⏳" : "📷"}
                      <span>{uploading ? "..." : "Add"}</span>
                    </button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleImageUpload(e.target.files)} />
                {error && <div className={styles.error}>{error}</div>}
                <div className={styles.btnRow}>
                  <button type="button" className={styles.prevBtn} onClick={() => setStep("details")}>
                    ← Back
                  </button>
                  <button type="button" className={styles.nextBtn} onClick={() => { setError(""); setStep("preview"); }}>
                    Preview →
                  </button>
                </div>
              </div>
            )}

            {step === "preview" && (
              <div className={styles.previewLayout}>
                <div className={styles.previewCard}>
                  <div className={styles.previewImg}>
                    {images[0] ? (
                      <img src={images[0]} alt="" className={styles.previewImgEl} />
                    ) : (
                      <div className={styles.previewImgPlaceholder}>📋</div>
                    )}
                  </div>
                  <div className={styles.previewBody}>
                    <div className={styles.previewTitle}>{form.title}</div>
                    <div className={styles.previewPrice}>{formatPiPriceDisplay(form.price_display)}</div>
                    <div className={styles.escrowBanner}>No escrow — contact directly</div>
                    <div className={styles.previewTags}>
                      {form.location && <span className={styles.tag}>📍 {form.location}</span>}
                      <span className={styles.tag}>
                        {getCountry(countryCode).flag} {getCountry(countryCode).name}
                      </span>
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
                    <button type="button" className={styles.prevBtn} onClick={() => setStep("images")}>
                    ← Back
                  </button>
                  <button type="button" className={styles.publishBtn} onClick={handleSubmit} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className={styles.rightCol}>
          <div className={styles.infoCard}>
            <div className={styles.infoTitle}>Supasifieds</div>
            <ul className={styles.infoList}>
              <li>Update contact details if your number changes</li>
              <li>Boost with SC from the ad page</li>
            </ul>
          </div>
          <div className={styles.infoCard}>
            <div className={styles.infoTitle}>Display price</div>
            <div className={styles.infoPrice}>{formatPiPriceDisplay(form.price_display)}</div>
          </div>
        </aside>
      </div>

      <div className={styles.stickyBottomBar}>
        <div className={styles.stickyPriceWrap}>
          <div className={styles.stickyLabel}>Display price</div>
          <div className={styles.stickyPrice}>{formatPiPriceDisplay(form.price_display)}</div>
        </div>
        {step !== "preview" ? (
          <button
            type="button"
            className={styles.stickyBuyBtn}
            onClick={() => {
              if (step === "details") goNextFromDetails();
              else {
                setError("");
                setStep("preview");
              }
            }}
          >
            {step === "details" ? "Next" : "Preview"}
          </button>
        ) : (
          <button type="button" className={styles.stickyBuyBtn} onClick={handleSubmit} disabled={saving}>
            {saving ? "..." : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}
