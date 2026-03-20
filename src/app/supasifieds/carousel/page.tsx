"use client";
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "../../supamarket/create/page.module.css";
import carouselStyles from "./page.module.css";

type MineListing = { id: string; title: string; images?: string[] };
type CarouselPackage = { days: number; sc: number; label: string };
const DEFAULT_PACKAGES: CarouselPackage[] = [
  { days: 3, sc: 180, label: "3 days carousel ad" },
  { days: 7, sc: 360, label: "7 days carousel ad" },
  { days: 14, sc: 650, label: "14 days carousel ad" },
];

export default function SupasifiedsCarouselCreatePage() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const fileRef = useRef<HTMLInputElement>(null);
  const isSupaauto = pathname?.startsWith("/supaauto");
  const isSupadomus = pathname?.startsWith("/supadomus");
  const appBase = isSupaauto ? "/supaauto" : isSupadomus ? "/supadomus" : "/supasifieds";
  const apiBase = isSupaauto ? "/api/supaauto" : isSupadomus ? "/api/supadomus" : "/api/supasifieds";

  const [mine, setMine] = useState<MineListing[]>([]);
  const [listingId, setListingId] = useState("");
  const [headline, setHeadline] = useState("");
  const [ctaLabel, setCtaLabel] = useState("View Ad");
  const [linkUrl, setLinkUrl] = useState("");
  const [durationDays, setDurationDays] = useState(7);
  const [carouselPackages, setCarouselPackages] = useState<CarouselPackage[]>(DEFAULT_PACKAGES);
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "");

  useEffect(() => {
    if (!user) return;
    fetch(`${apiBase}/listings/mine`, { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data)) setMine(d.data);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    fetch(`${apiBase}/promote/config`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data?.carouselPackages) && d.data.carouselPackages.length) {
          setCarouselPackages(d.data.carouselPackages);
          const hasCurrent = d.data.carouselPackages.some((x: CarouselPackage) => x.days === durationDays);
          if (!hasCurrent) setDurationDays(d.data.carouselPackages[0].days);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!listingId) return;
    const selected = mine.find((x) => x.id === listingId);
    if (!selected) return;
    if (!headline.trim()) setHeadline(selected.title);
    if (!linkUrl.trim()) setLinkUrl(`${appBase}/${selected.id}`);
    if (!imageUrl && selected.images?.[0]) setImageUrl(selected.images[0]);
  }, [listingId, mine, headline, linkUrl, imageUrl]);

  const uploadImage = async (file?: File | null) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("index", "0");
      const r = await fetch(`${apiBase}/images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
        body: fd,
      });
      const d = await r.json();
      if (d.success) setImageUrl(String(d.data.url));
      else setError(d.error ?? "Upload failed");
    } catch {
      setError("Upload failed");
    }
    setUploading(false);
  };

  const submit = async () => {
    setError("");
    setOk("");
    if (!imageUrl || !headline.trim() || !linkUrl.trim()) {
      setError("Image, headline, and link are required");
      return;
    }
    const t = token();
    if (!t) return;
    setSubmitting(true);
    try {
      const r = await fetch(`${apiBase}/promote/carousel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({
          listing_id: listingId || null,
          image_url: imageUrl.trim(),
          headline: headline.trim(),
          cta_label: ctaLabel.trim() || "View",
          link_url: linkUrl.trim(),
          duration_days: durationDays,
        }),
      });
      const d = await r.json();
      if (!d.success) {
        setError(d.error ?? "Failed to launch campaign");
      } else {
        setOk("Carousel campaign launched");
      }
    } catch {
      setError("Failed to launch campaign");
    }
    setSubmitting(false);
  };

  if (!user) return null;

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.iconBtn} onClick={() => router.back()}>
          ←
        </button>
        <h1 className={styles.title}>
          {isSupaauto ? "Create SupaAuto Carousel Ad" : isSupadomus ? "Create SupaDomus Carousel Ad" : "Create Carousel Ad"}
        </h1>
        <Link href={`${appBase}/my-listings`} className={styles.iconBtn}>
          📂
        </Link>
      </div>
      <div className={styles.layout}>
        <div className={styles.leftCol}>
          <div className={styles.formCard}>
            <div className={styles.form}>
              <div className={styles.formField}>
                <label className={styles.label}>Attach listing (optional)</label>
                <select className={styles.input} value={listingId} onChange={(e) => setListingId(e.target.value)}>
                  <option value="">Standalone campaign</option>
                  {mine.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formField}>
                <label className={styles.label}>Headline</label>
                <input className={styles.input} value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={120} />
              </div>
              <div className={styles.formField}>
                <label className={styles.label}>CTA label</label>
                <input className={styles.input} value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={20} />
              </div>
              <div className={styles.formField}>
                <label className={styles.label}>Destination URL</label>
                <input className={styles.input} value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder={`${appBase}/...`} />
              </div>
              <div className={styles.formField}>
                <label className={styles.label}>Campaign duration</label>
                <div className={styles.optionGrid}>
                  {carouselPackages.map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      className={`${styles.optBtn} ${durationDays === opt.days ? styles.optBtnActive : ""}`}
                      onClick={() => setDurationDays(opt.days)}
                    >
                      {opt.days} days · {opt.sc} SC
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.formField}>
                <label className={styles.label}>Banner image</label>
                {imageUrl ? (
                  <div className={styles.previewImg}>
                    <img src={imageUrl} alt="" className={styles.previewImgEl} />
                  </div>
                ) : null}
                <div className={styles.btnRow}>
                  <button className={styles.prevBtn} type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? "Uploading..." : "Upload image"}
                  </button>
                </div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => uploadImage(e.target.files?.[0])} />
              </div>
              {error ? <div className={styles.error}>{error}</div> : null}
              {ok ? <div style={{ color: "#276749", fontWeight: 700 }}>{ok}</div> : null}
              <button
                className={`${styles.publishBtn} ${carouselStyles.launchBtn}`}
                type="button"
                disabled={submitting}
                onClick={submit}
              >
                {submitting ? "Launching..." : "🎠 Launch Carousel Campaign"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
