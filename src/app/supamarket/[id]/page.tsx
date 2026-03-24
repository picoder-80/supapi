"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import KycBadge from "@/components/ui/KycBadge";
import { CONDITIONS, BUYING_METHODS, formatListingCategoryPath } from "@/lib/market/categories";
import { ensurePaymentReady, createPiPayment, isPiBrowser, getApiBase } from "@/lib/pi/sdk";
import styles from "./page.module.css";

interface Listing {
  id: string; title: string; description: string; price_pi: number;
  category: string; subcategory: string; category_deep?: string | null;
  condition: string; buying_method: string;
  images: string[]; stock: number; status: string; location: string;
  views: number; likes: number; created_at: string; type: string;
  liked?: boolean;
  seller: { id: string; username: string; display_name: string | null; avatar_url: string | null; kyc_status: string; created_at: string; rating_avg?: number; rating_count?: number; sales_count?: number };
}

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }

/** Ensure maps / share links are valid hrefs (add https if missing). */
function normalizeOptionalUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t.replace(/^\/+/, "")}`;
}

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  const [listing, setListing]     = useState<Listing | null>(null);
  const [loading, setLoading]     = useState(true);
  const [imgIndex, setImgIndex]   = useState(0);
  const [showCheckout, setShowCheckout] = useState(false);
  const [buyMethod, setBuyMethod] = useState<"meetup" | "ship" | "digital">("meetup");
  const [checkoutStep, setCheckoutStep] = useState<"method" | "details" | "confirm">("method");
  const [form, setForm]           = useState({
    shipping_name: "",
    shipping_address: "",
    shipping_city: "",
    shipping_postcode: "",
    shipping_country: "United States",
    meetup_location: "",
    meetup_phone: "",
    meetup_directions_url: "",
    digital_contact: "",
    notes: "",
  });
  const [placing, setPlacing]     = useState(false);
  const [error, setError]         = useState("");
  const [showBoost, setShowBoost] = useState(false);
  const [boostTier, setBoostTier] = useState("");
  const [boosting, setBoosting]   = useState(false);
  const [liking, setLiking]       = useState(false);
  const [scBalance, setScBalance] = useState<number | null>(null);

  useEffect(() => {
    const fetch_ = async () => {
      setLoading(true);
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "";
        const r = await fetch(`/api/supamarket/listings/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const d = await r.json();
        if (d.success) {
          setListing(d.data);
          if (d.data.buying_method === "ship") setBuyMethod("ship");
          else if (d.data.buying_method === "digital" || d.data.type === "digital") setBuyMethod("digital");
        }
      } catch {}
      setLoading(false);
    };
    fetch_();
  }, [id]);

  const handleLike = async () => {
    if (!user) { router.push("/dashboard"); return; }
    const token = localStorage.getItem("supapi_token");
    if (!token || !listing) return;
    setLiking(true);
    try {
      const r = await fetch(`/api/supamarket/listings/${id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.success && d.data) {
        setListing(prev => prev ? { ...prev, liked: d.data.liked, likes: d.data.like_count } : null);
      }
    } catch {}
    setLiking(false);
  };

  // Pre-fill shipping from user profile
  useEffect(() => {
    const prefill = async () => {
      const token = localStorage.getItem("supapi_token");
      if (!token) return;
      const r = await fetch("/api/dashboard/profile", { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.success && d.data) {
        setForm(prev => ({
          ...prev,
          shipping_name:    d.data.display_name ?? "",
          shipping_address: d.data.address_line1 ?? "",
          shipping_city:    d.data.city ?? "",
          shipping_postcode:d.data.postcode ?? "",
          shipping_country: d.data.country ?? "United States",
        }));
      }
    };
    if (user) prefill();
  }, [user]);

  useEffect(() => {
    const fetchScBalance = async () => {
      const token = localStorage.getItem("supapi_token");
      if (!token) return;
      try {
        const r = await fetch("/api/wallet?tab=sc", { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (d.success && d.data?.scWallet?.balance != null) setScBalance(d.data.scWallet.balance);
      } catch {}
    };
    if (user) fetchScBalance();
  }, [user]);

  const handleCheckout = async () => {
    if (!user) { router.push("/dashboard"); return; }
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    if (buyMethod === "ship") {
      if (!form.shipping_name?.trim() || !form.shipping_address?.trim() || !form.shipping_city?.trim() || !form.shipping_postcode?.trim()) {
        setError("Please fill in all shipping details");
        return;
      }
    } else if (buyMethod === "meetup") {
      if (!form.meetup_location?.trim()) {
        setError("Please enter meetup location");
        return;
      }
      if (!form.meetup_phone?.trim()) {
        setError("Please enter your phone number");
        return;
      }
    } else if (buyMethod === "digital" && !form.digital_contact?.trim()) {
      setError("Please enter your delivery contact for digital delivery");
      return;
    }
    setPlacing(true); setError("");
    try {
      // 1. Create order
      const composedNotes = (() => {
        if (buyMethod === "digital") {
          return [`Digital contact: ${form.digital_contact.trim()}`, form.notes?.trim() ?? ""]
            .map((v) => String(v ?? "").trim())
            .filter(Boolean)
            .join("\n");
        }
        if (buyMethod === "meetup") {
          const parts = [
            `Meetup buyer phone: ${form.meetup_phone.trim()}`,
            form.meetup_directions_url.trim()
              ? `Directions: ${normalizeOptionalUrl(form.meetup_directions_url)}`
              : "",
            form.notes?.trim() ?? "",
          ];
          return parts.map((v) => String(v ?? "").trim()).filter(Boolean).join("\n");
        }
        return String(form.notes ?? "").trim();
      })();

      const r = await fetch("/api/supamarket/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          listing_id: listing!.id, buying_method: buyMethod,
          ...(buyMethod === "ship" ? {
            shipping_name: form.shipping_name,
            shipping_address: form.shipping_address,
            shipping_city: form.shipping_city,
            shipping_postcode: form.shipping_postcode,
            shipping_country: form.shipping_country,
          } : { meetup_location: form.meetup_location }),
          notes: composedNotes,
        }),
      });
      const d = await r.json();
      if (!d.success) { setError(d.error ?? "Failed to create order"); setPlacing(false); return; }

      const orderId = d.data.id;

      // 2. Pi Payment — ensure "payments" scope before createPayment (required by Pi SDK v2)
      if (typeof window !== "undefined" && isPiBrowser()) {
        await ensurePaymentReady();
        createPiPayment(
          {
            amount: Number(listing!.price_pi),
            memo: `Supapi Market: ${listing!.title}`,
            metadata: { order_id: orderId, listing_id: listing!.id },
          },
          {
            // Fire-and-forget: Pi docs expect fast return here.
            onReadyForServerApproval: (paymentId: string) => {
              const base = getApiBase();
              fetch(`${base || ""}/api/payments/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  paymentId,
                  type: "listing",
                  referenceId: orderId,
                  amountPi: Number(listing!.price_pi),
                  memo: `Supapi Market: ${listing!.title}`,
                  metadata: { platform: "market", order_id: orderId, listing_id: listing!.id },
                }),
              })
                .then(async (r) => {
                  const d = await r.json().catch(() => ({}));
                  if (!r.ok) throw new Error(d.error ?? "Payment approval failed");
                })
                .catch((err: unknown) => {
                  const msg = err instanceof Error ? err.message : "Payment approval failed";
                  setError(msg);
                  setPlacing(false);
                });
            },
            onReadyForServerCompletion: async (paymentId: string, txid: string) => {
              const base = getApiBase();
              const completeUrl = `${base || ""}/api/payments/complete`;
              const maxAttempts = 12;
              const delayMs = 4000;
              let lastErr = "Payment completion failed";

              for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                  const rComplete = await fetch(completeUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ paymentId, txid }),
                  });
                  const dComplete = await rComplete.json().catch(() => ({}));
                  if (!rComplete.ok) {
                    lastErr = dComplete.error ?? `Complete failed (${rComplete.status})`;
                    if (attempt < maxAttempts) {
                      await new Promise((r) => setTimeout(r, delayMs));
                      continue;
                    }
                    setError(lastErr);
                    setPlacing(false);
                    return;
                  }
                  router.push(`/supamarket/orders/${orderId}`);
                  return;
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : "Network error";
                  lastErr = msg;
                  if (attempt < maxAttempts) {
                    await new Promise((r) => setTimeout(r, delayMs));
                    continue;
                  }
                  setError(`Payment completion failed: ${msg}`);
                  setPlacing(false);
                  return;
                }
              }

              setError(lastErr);
              setPlacing(false);
            },
            onCancel: async () => {
              const base = getApiBase();
              await fetch(`${base || ""}/api/supamarket/orders/${orderId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status: "cancelled" }),
              });
              setError("Payment cancelled.");
              setPlacing(false);
            },
            onError: () => {
              setError("Payment error. Please try again.");
              setPlacing(false);
            },
          }
        );
      } else {
        router.push(`/supamarket/orders/${orderId}`);
      }
    } catch (err: any) {
      const msg = err?.message ?? (typeof err === "string" ? err : "Something went wrong.");
      setError(msg);
      setPlacing(false);
    }
  };

  if (loading) return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.iconBtn} type="button" aria-label="Go back">←</button>
        <div className={styles.topBarTitle}>SupaMarket</div>
        <button className={styles.iconBtn} type="button" aria-label="Share">⤴</button>
      </div>
      <div className={styles.skeletonWrap}>
        <div className={styles.skeletonGallery} />
        <div className={styles.skeletonCard}>
          <div className={styles.skeletonLineLg} />
          <div className={styles.skeletonLineMd} />
          <div className={styles.skeletonLineSm} />
        </div>
        <div className={styles.skeletonCard}>
          <div className={styles.skeletonLineMd} />
          <div className={styles.skeletonLineSm} />
          <div className={styles.skeletonLineSm} />
        </div>
      </div>
    </div>
  );

  if (!listing) return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.iconBtn} type="button" onClick={() => router.back()} aria-label="Go back">←</button>
        <div className={styles.topBarTitle}>SupaMarket</div>
        <button className={styles.iconBtn} type="button" aria-label="Share">⤴</button>
      </div>
      <div className={styles.notFoundCard}>
        <div className={styles.notFoundIcon}>🔍</div>
        <div className={styles.notFoundTitle}>Listing not found</div>
        <p className={styles.notFoundText}>The product may have been removed or is no longer available.</p>
        <button className={styles.notFoundBtn} onClick={() => router.back()}>Back</button>
      </div>
    </div>
  );

  const BOOST_TIERS: Record<string, { sc: number; hrs: number; label: string }> = {
    bronze: { sc: 100, hrs: 24,  label: "🥉 Bronze · 24h" },
    silver: { sc: 250, hrs: 48,  label: "🥈 Silver · 48h" },
    gold:   { sc: 500, hrs: 72,  label: "👑 Gold · 72h"   },
  };

  const handleBoost = async () => {
    if (!boostTier || !BOOST_TIERS[boostTier]) return;
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    setBoosting(true);
    try {
      const r = await fetch("/api/supamarket/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ listing_id: id, tier: boostTier }),
      });
      const d = await r.json();
      if (d.success) {
        setShowBoost(false);
        setBoostTier("");
        const fetch_ = async () => {
          const r2 = await fetch(`/api/supamarket/listings/${id}`);
          const d2 = await r2.json();
          if (d2.success) setListing(d2.data);
        };
        fetch_();
      } else setError(d.error ?? "Boost failed");
    } catch { setError("Something went wrong"); }
    setBoosting(false);
  };

  const conditionLabel = CONDITIONS.find(c => c.id === listing.condition)?.label ?? listing.condition;
  const methodLabel    = BUYING_METHODS.find(m => m.id === listing.buying_method);
  const isOwnListing   = user?.id === listing.seller.id;
  const images         = listing.images?.length ? listing.images : [];
  const isDigitalListing = listing.buying_method === "digital" || listing.type === "digital";

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.iconBtn} type="button" onClick={() => router.back()} aria-label="Go back">←</button>
        <div className={styles.topBarTitle}>SupaMarket</div>
        <button className={styles.iconBtn} type="button" aria-label="Share">⤴</button>
      </div>

      <div className={styles.layout}>
        <div className={styles.leftCol}>
          <div className={styles.galleryCard}>
            {images.length > 0 ? (
              <>
                <div className={styles.mainImg}>
                  <img src={images[imgIndex]} alt={listing.title} className={styles.mainImgEl} />
                  {listing.status === "sold" && <div className={styles.soldOverlay}>SOLD</div>}
                </div>
                {images.length > 1 && (
                  <div className={styles.dotsRow}>
                    {images.map((_, i) => (
                      <button
                        key={i}
                        className={`${styles.dot} ${i === imgIndex ? styles.dotActive : ""}`}
                        onClick={() => setImgIndex(i)}
                        aria-label={`View image ${i + 1}`}
                      />
                    ))}
                  </div>
                )}
                {images.length > 1 && (
                  <div className={styles.thumbRow}>
                    {images.map((img, i) => (
                      <button key={i} className={`${styles.thumb} ${i === imgIndex ? styles.thumbActive : ""}`} onClick={() => setImgIndex(i)}>
                        <img src={img} alt="" className={styles.thumbImg} />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className={styles.noImg}>🛍️</div>
            )}
          </div>
        </div>

        <div className={styles.rightCol}>
          <div className={styles.infoCard}>
            <div className={styles.titleRow}>
              <h1 className={styles.listingTitle}>{listing.title}</h1>
              <div className={styles.listingPrice}>{Number(listing.price_pi).toFixed(2)} π</div>
            </div>
            <div className={styles.tags}>
              <span className={styles.tag}>{conditionLabel}</span>
              <span className={styles.tag}>{methodLabel?.emoji} {methodLabel?.label ?? listing.buying_method}</span>
              {listing.location && <span className={styles.tag}>📍 {listing.location}</span>}
              <span className={styles.tag}>
                {formatListingCategoryPath(
                  listing.category,
                  listing.subcategory ?? "",
                  listing.category_deep
                )}
              </span>
            </div>
            <div className={styles.escrowBanner}>π held in escrow until you confirm delivery</div>
          </div>

          <div className={styles.infoCard}>
            <div className={styles.sectionTitle}>Seller</div>
            <Link href={`/supaspace/${listing.seller.username}`} className={styles.sellerCard}>
              <div className={styles.sellerAvatar}>
                {listing.seller.avatar_url
                  ? <img src={listing.seller.avatar_url} alt="" className={styles.sellerAvatarImg} />
                  : <span className={styles.sellerAvatarInitial}>{getInitial(listing.seller.username)}</span>
                }
              </div>
              <div className={styles.sellerInfo}>
                <div className={styles.sellerName}>
                  {listing.seller.display_name ?? listing.seller.username}
                  {listing.seller.kyc_status === "verified" && <span className={styles.kycBadge}><KycBadge size={14} /></span>}
                </div>
                <div className={styles.sellerMeta}>
                  ★ {(listing.seller.rating_avg ?? 0) > 0 ? (listing.seller.rating_avg ?? 0).toFixed(1) : "—"}
                  {(listing.seller.rating_count ?? 0) > 0 && ` (${listing.seller.rating_count} ${(listing.seller.rating_count ?? 0) === 1 ? "review" : "reviews"})`}
                  {" · "}
                  {(listing.seller.sales_count ?? 0)} {(listing.seller.sales_count ?? 0) === 1 ? "sale" : "sales"}
                </div>
                <div className={styles.sellerSub}>@{listing.seller.username}</div>
              </div>
              <span className={styles.viewShopBtn}>View Profile</span>
            </Link>
          </div>

          {listing.description && (
            <div className={styles.infoCard}>
              <div className={styles.sectionTitle}>Description</div>
              <details className={styles.descriptionWrap}>
                <summary className={styles.readMore}>Read more</summary>
                <div className={styles.description}>{listing.description}</div>
              </details>
            </div>
          )}

          <div className={styles.infoCard}>
            <div className={styles.statsRow}>
              <span className={styles.stat}>👁 {listing.views} views</span>
              <button
                type="button"
                className={`${styles.likeBtn} ${listing.liked ? styles.likeBtnLiked : ""}`}
                onClick={handleLike}
                disabled={liking}
                aria-label={listing.liked ? "Unlike" : "Like"}
              >
                {listing.liked ? "❤️" : "🤍"} {listing.likes > 0 ? listing.likes : ""} {listing.likes === 1 ? "like" : "likes"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Checkout Button */}
      {!isOwnListing && listing.status === "active" && (
        <div className={styles.stickyBar}>
          <div className={styles.stickySummary}>
            <div className={styles.stickyLabel}>Total</div>
            <div className={styles.stickyPrice}>{Number(listing.price_pi).toFixed(2)} π</div>
          </div>
          <button
            className={styles.buyBtn}
            onClick={() => {
              setError("");
              if (isDigitalListing) {
                setBuyMethod("digital");
                setCheckoutStep("details");
              } else {
                setCheckoutStep("method");
              }
              setShowCheckout(true);
            }}
          >
            Buy Now 🛒
          </button>
        </div>
      )}

      {/* Back & owner actions at bottom */}
      <div className={styles.bottomBar}>
        <button className={styles.backBtn} onClick={() => router.back()}>← Back</button>
        {isOwnListing && (
          <div className={styles.bottomActions}>
            {listing.status === "active" && (
              <button className={styles.ownerBoostBtn} onClick={() => setShowBoost(true)}>🚀 Boost</button>
            )}
            <Link href={`/supamarket/${id}/edit`} className={styles.manageBtn}>Edit Listing</Link>
            <Link href="/supamarket/my-listings" className={styles.manageBtn}>Manage Listings →</Link>
          </div>
        )}
      </div>

      {/* Checkout Sheet */}
      {showCheckout && (
        <div className={styles.overlay} onClick={() => !placing && setShowCheckout(false)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetHeader}>
              <div className={styles.sheetTitle}>Checkout</div>
              <button className={styles.sheetClose} onClick={() => !placing && setShowCheckout(false)}>✕</button>
            </div>

            <div className={styles.sheetBody}>
              {/* Product summary */}
              <div className={styles.checkoutSummary}>
                {images[0] && <img src={images[0]} alt="" className={styles.checkoutImg} />}
                <div>
                  <div className={styles.checkoutTitle}>{listing.title}</div>
                  <div className={styles.checkoutPrice}>{Number(listing.price_pi).toFixed(2)} π</div>
                </div>
              </div>

              {checkoutStep === "method" && (
                <>
                  <div className={styles.stepTitle}>Select buying method</div>
                  <div className={styles.methodOptions}>
                    {(listing.buying_method === "meetup" || listing.buying_method === "both") && (
                      <button className={`${styles.methodOpt} ${buyMethod === "meetup" ? styles.methodOptActive : ""}`}
                        onClick={() => setBuyMethod("meetup")}>
                        <div className={styles.methodIcon}>📍</div>
                        <div className={styles.methodLabel}>Meetup</div>
                        <div className={styles.methodDesc}>Meet seller in person</div>
                      </button>
                    )}
                    {(listing.buying_method === "ship" || listing.buying_method === "both") && (
                      <button className={`${styles.methodOpt} ${buyMethod === "ship" ? styles.methodOptActive : ""}`}
                        onClick={() => setBuyMethod("ship")}>
                        <div className={styles.methodIcon}>📦</div>
                        <div className={styles.methodLabel}>Shipping</div>
                        <div className={styles.methodDesc}>Deliver to your address</div>
                      </button>
                    )}
                  </div>
                  <button
                    className={`${styles.nextBtn} ${styles.singleActionBtn}`}
                    onClick={() => {
                      setError("");
                      setCheckoutStep("details");
                    }}
                  >
                    Continue →
                  </button>
                </>
              )}

              {checkoutStep === "details" && (
                <>
                  <div className={styles.stepTitle}>
                    {buyMethod === "ship" ? "Shipping Details" : buyMethod === "meetup" ? "Meetup Details" : "Digital Delivery Details"}
                  </div>
                  {buyMethod === "ship" ? (
                    <>
                      {[
                        { key: "shipping_name",     label: "Full Name",    type: "text",  placeholder: "Your full name" },
                        { key: "shipping_address",  label: "Address",      type: "text",  placeholder: "Street address" },
                        { key: "shipping_city",     label: "City",         type: "text",  placeholder: "Los Angeles" },
                        { key: "shipping_postcode", label: "Postcode",     type: "text",  placeholder: "10001" },
                        { key: "shipping_country",  label: "Country",      type: "text",  placeholder: "United States" },
                      ].map(f => (
                        <div key={f.key} className={styles.formField}>
                          <label className={styles.formLabel}>{f.label}</label>
                          <input className={styles.formInput} type={f.type} placeholder={f.placeholder}
                            value={form[f.key as keyof typeof form]}
                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                        </div>
                      ))}
                    </>
                  ) : buyMethod === "meetup" ? (
                    <>
                      <div className={styles.formField}>
                        <label className={styles.formLabel}>Preferred Meetup Location</label>
                        <input
                          className={styles.formInput}
                          placeholder="e.g. Times Square, New York"
                          value={form.meetup_location}
                          onChange={e => setForm(prev => ({ ...prev, meetup_location: e.target.value }))}
                        />
                      </div>
                      <div className={styles.formField}>
                        <label className={styles.formLabel}>Phone No. <span aria-hidden>*</span></label>
                        <input
                          className={styles.formInput}
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="e.g. +60 12-345 6789"
                          value={form.meetup_phone}
                          onChange={e => setForm(prev => ({ ...prev, meetup_phone: e.target.value }))}
                          required
                          aria-required
                        />
                      </div>
                      <div className={styles.formField}>
                        <label className={styles.formLabel}>Direction to share (optional)</label>
                        <input
                          className={styles.formInput}
                          type="url"
                          inputMode="url"
                          placeholder="https://maps.app.goo.gl/…"
                          value={form.meetup_directions_url}
                          onChange={e => setForm(prev => ({ ...prev, meetup_directions_url: e.target.value }))}
                        />
                      </div>
                    </>
                  ) : (
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Delivery contact <span aria-hidden>*</span></label>
                      <input
                        className={styles.formInput}
                        placeholder="Email / username / handle for digital delivery"
                        value={form.digital_contact}
                        onChange={e => setForm(prev => ({ ...prev, digital_contact: e.target.value }))}
                        required
                        aria-required
                      />
                    </div>
                  )}
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Notes to Seller (optional)</label>
                    <textarea className={styles.formInput} rows={2} placeholder="Any special request..."
                      value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
                  </div>
                  {error && <div className={styles.errorMsg}>{error}</div>}
                  <div className={styles.btnRow}>
                    <button
                      className={styles.backStep}
                      onClick={() => {
                        setError("");
                        if (buyMethod === "digital") {
                          setShowCheckout(false);
                          return;
                        }
                        setCheckoutStep("method");
                      }}
                    >
                      ← Back
                    </button>
                    <button
                      className={styles.nextBtn}
                      onClick={() => {
                        setError("");
                        if (buyMethod === "meetup") {
                          if (!form.meetup_location?.trim()) {
                            setError("Please enter your preferred meetup location");
                            return;
                          }
                          if (!form.meetup_phone?.trim()) {
                            setError("Please enter your phone number");
                            return;
                          }
                        } else if (buyMethod === "ship") {
                          if (!form.shipping_name?.trim() || !form.shipping_address?.trim() || !form.shipping_city?.trim() || !form.shipping_postcode?.trim()) {
                            setError("Please fill in all shipping details (name, address, city, postcode)");
                            return;
                          }
                        } else if (buyMethod === "digital") {
                          if (!form.digital_contact?.trim()) {
                            setError("Please enter your delivery contact for digital delivery");
                            return;
                          }
                        }
                        setCheckoutStep("confirm");
                      }}
                    >
                      Review Order →
                    </button>
                  </div>
                </>
              )}

              {checkoutStep === "confirm" && (
                <>
                  <div className={styles.stepTitle}>Review & Pay</div>
                  <div className={styles.confirmBox}>
                    <div className={styles.confirmRow}>
                      <span>Method</span>
                      <strong>
                        {buyMethod === "ship" ? "📦 Shipping" : buyMethod === "meetup" ? "📍 Meetup" : "💻 Digital Delivery"}
                      </strong>
                    </div>
                    {buyMethod === "ship" && <>
                      <div className={styles.confirmRow}><span>Deliver to</span><strong>{form.shipping_name}</strong></div>
                      <div className={styles.confirmRow}><span>Address</span><strong>{form.shipping_address}, {form.shipping_city} {form.shipping_postcode}</strong></div>
                    </>}
                    {buyMethod === "meetup" && form.meetup_location && (
                      <div className={styles.confirmRow}><span>Location</span><strong>{form.meetup_location}</strong></div>
                    )}
                    {buyMethod === "meetup" && form.meetup_phone.trim() ? (
                      <div className={styles.confirmRow}><span>Phone</span><strong>{form.meetup_phone.trim()}</strong></div>
                    ) : null}
                    {buyMethod === "meetup" && form.meetup_directions_url.trim() ? (
                      <div className={styles.confirmRow}>
                        <span>Directions</span>
                        <a
                          href={normalizeOptionalUrl(form.meetup_directions_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.confirmLink}
                        >
                          Open map link
                        </a>
                      </div>
                    ) : null}
                    {buyMethod === "digital" && form.digital_contact.trim() ? (
                      <div className={styles.confirmRow}><span>Delivery contact</span><strong>{form.digital_contact.trim()}</strong></div>
                    ) : null}
                    <div className={styles.confirmRow}><span>Payment</span><strong>Pi Escrow</strong></div>
                    <div className={`${styles.confirmRow} ${styles.confirmTotal}`}>
                      <span>Total</span><strong>{Number(listing.price_pi).toFixed(2)} π</strong>
                    </div>
                  </div>
                  <div className={styles.escrowNote}>
                    🔒 Pi will be held in escrow until you confirm delivery
                  </div>
                  {error && <div className={styles.errorMsg}>{error}</div>}
                  <div className={styles.btnRow}>
                    <button
                      className={styles.backStep}
                      onClick={() => {
                        setError("");
                        setCheckoutStep("details");
                      }}
                    >
                      ← Back
                    </button>
                    <button className={styles.payBtn} onClick={handleCheckout} disabled={placing}>
                      {placing ? "Processing..." : `Pay ${Number(listing.price_pi).toFixed(2)} π`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Boost sheet (own listing) */}
      {showBoost && isOwnListing && listing.status === "active" && (
        <div className={styles.boostOverlay} onClick={() => !boosting && setShowBoost(false)}>
          <div className={styles.boostSheet} onClick={e => e.stopPropagation()}>
            <div className={styles.boostHeader}>
              <div className={styles.boostTitle}>🚀 Boost Listing</div>
              <button className={styles.boostClose} onClick={() => !boosting && setShowBoost(false)}>✕</button>
            </div>
            <div className={styles.boostBody}>
              <div className={styles.boostSummary}>
                <div className={styles.boostSummaryImage}>
                  {images[0] ? <img src={images[0]} alt="" className={styles.boostSummaryImageEl} /> : <span>🛍️</span>}
                </div>
                <div className={styles.boostSummaryInfo}>
                  <div className={styles.boostItem}>{listing.title}</div>
                  <div className={styles.boostSummaryPrice}>{Number(listing.price_pi).toFixed(2)} π</div>
                </div>
              </div>
              {scBalance != null && <div className={styles.boostBalance}>Your SC Balance: <strong>{scBalance}</strong></div>}
              <div className={styles.boostStepTitle}>Select boost tier</div>
              <div className={styles.boostTiers}>
                {(Object.entries(BOOST_TIERS) as [string, { sc: number; hrs: number; label: string }][]).map(([tier, info]) => (
                  <button
                    key={tier}
                    className={`${styles.boostTier} ${boostTier === tier ? styles.boostTierActive : ""}`}
                    onClick={() => setBoostTier(tier)}
                    disabled={scBalance != null && scBalance < info.sc}
                  >
                    <span className={styles.boostTierLabel}>{info.label}</span>
                    <span className={styles.boostTierSc}>{info.sc} SC</span>
                  </button>
                ))}
              </div>
              <button className={styles.boostBtn} disabled={!boostTier || boosting} onClick={handleBoost}>
                {boosting ? "Processing..." : `Boost for ${boostTier ? BOOST_TIERS[boostTier].sc : 0} SC`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}