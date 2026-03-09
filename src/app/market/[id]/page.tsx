"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { CONDITIONS, BUYING_METHODS } from "@/lib/market/categories";
import styles from "./page.module.css";

interface Listing {
  id: string; title: string; description: string; price_pi: number;
  category: string; subcategory: string; condition: string; buying_method: string;
  images: string[]; stock: number; status: string; location: string;
  views: number; likes: number; created_at: string; type: string;
  seller: { id: string; username: string; display_name: string | null; avatar_url: string | null; kyc_status: string; created_at: string };
}

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  const [listing, setListing]     = useState<Listing | null>(null);
  const [loading, setLoading]     = useState(true);
  const [imgIndex, setImgIndex]   = useState(0);
  const [showCheckout, setShowCheckout] = useState(false);
  const [buyMethod, setBuyMethod] = useState<"meetup" | "ship">("meetup");
  const [checkoutStep, setCheckoutStep] = useState<"method" | "details" | "confirm">("method");
  const [form, setForm]           = useState({ shipping_name: "", shipping_address: "", shipping_city: "", shipping_postcode: "", shipping_country: "Malaysia", meetup_location: "", notes: "" });
  const [placing, setPlacing]     = useState(false);
  const [error, setError]         = useState("");

  useEffect(() => {
    const fetch_ = async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/market/listings/${id}`);
        const d = await r.json();
        if (d.success) {
          setListing(d.data);
          if (d.data.buying_method === "ship") setBuyMethod("ship");
        }
      } catch {}
      setLoading(false);
    };
    fetch_();
  }, [id]);

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
          shipping_country: d.data.country ?? "Malaysia",
        }));
      }
    };
    if (user) prefill();
  }, [user]);

  const handleCheckout = async () => {
    if (!user) { router.push("/dashboard"); return; }
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    setPlacing(true); setError("");
    try {
      // 1. Create order
      const r = await fetch("/api/market/orders", {
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
          notes: form.notes,
        }),
      });
      const d = await r.json();
      if (!d.success) { setError(d.error ?? "Failed to create order"); setPlacing(false); return; }

      const orderId = d.data.id;

      // 2. Pi Payment
      if (typeof window !== "undefined" && (window as any).Pi) {
        const Pi = (window as any).Pi;
        await Pi.createPayment({
          amount: Number(listing!.price_pi),
          memo: `Supapi Market: ${listing!.title}`,
          metadata: { order_id: orderId, listing_id: listing!.id },
        }, {
          onReadyForServerApproval: async (paymentId: string) => {
            await fetch("/api/payments/approve", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ paymentId }),
            });
          },
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            await fetch("/api/payments/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ paymentId, txid }),
            });
            // Update order to paid
            await fetch(`/api/market/orders/${orderId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ status: "paid", pi_payment_id: paymentId }),
            });
            router.push(`/market/orders/${orderId}`);
          },
          onCancel: async (paymentId: string) => {
            await fetch(`/api/market/orders/${orderId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ status: "cancelled" }),
            });
            setError("Payment cancelled.");
            setPlacing(false);
          },
          onError: (error: any) => {
            setError("Payment error. Please try again.");
            setPlacing(false);
          },
        });
      } else {
        // Sandbox — skip Pi SDK, go straight to order
        router.push(`/market/orders/${orderId}`);
      }
    } catch { setError("Something went wrong."); setPlacing(false); }
  };

  if (loading) return (
    <div className={styles.loading}>
      <div className={styles.loadingSpinner}>⏳</div>
      <div>Loading listing...</div>
    </div>
  );

  if (!listing) return (
    <div className={styles.notFound}>
      <div className={styles.notFoundIcon}>🔍</div>
      <div className={styles.notFoundTitle}>Listing not found</div>
      <Link href="/market" className={styles.backBtn}>← Back to Market</Link>
    </div>
  );

  const conditionLabel = CONDITIONS.find(c => c.id === listing.condition)?.label ?? listing.condition;
  const methodLabel    = BUYING_METHODS.find(m => m.id === listing.buying_method);
  const isOwnListing   = user?.id === listing.seller.id;
  const images         = listing.images?.length ? listing.images : [];

  return (
    <div className={styles.page}>
      {/* Back */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => router.back()}>← Back</button>
        {isOwnListing && (
          <Link href={`/market/my-listings`} className={styles.editBtn}>Edit Listing</Link>
        )}
      </div>

      {/* Image Gallery */}
      <div className={styles.gallery}>
        {images.length > 0 ? (
          <>
            <div className={styles.mainImg}>
              <img src={images[imgIndex]} alt={listing.title} className={styles.mainImgEl} />
              {listing.status === "sold" && <div className={styles.soldOverlay}>SOLD</div>}
            </div>
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

      {/* Details */}
      <div className={styles.details}>
        {/* Title & Price */}
        <div className={styles.titleRow}>
          <h1 className={styles.listingTitle}>{listing.title}</h1>
          <div className={styles.listingPrice}>{Number(listing.price_pi).toFixed(2)} π</div>
        </div>

        {/* Tags */}
        <div className={styles.tags}>
          <span className={styles.tag}>{conditionLabel}</span>
          <span className={styles.tag}>{methodLabel?.emoji} {methodLabel?.label ?? listing.buying_method}</span>
          {listing.location && <span className={styles.tag}>📍 {listing.location}</span>}
          <span className={styles.tag}>{listing.stock > 1 ? `${listing.stock} available` : "1 left"}</span>
        </div>

        {/* Description */}
        {listing.description && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Description</div>
            <div className={styles.description}>{listing.description}</div>
          </div>
        )}

        {/* Seller */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Seller</div>
          <Link href={`/myspace/${listing.seller.username}`} className={styles.sellerCard}>
            <div className={styles.sellerAvatar}>
              {listing.seller.avatar_url
                ? <img src={listing.seller.avatar_url} alt="" className={styles.sellerAvatarImg} />
                : <span className={styles.sellerAvatarInitial}>{getInitial(listing.seller.username)}</span>
              }
            </div>
            <div className={styles.sellerInfo}>
              <div className={styles.sellerName}>
                {listing.seller.display_name ?? listing.seller.username}
                {listing.seller.kyc_status === "verified" && <span className={styles.kycBadge}> ✅</span>}
              </div>
              <div className={styles.sellerSub}>@{listing.seller.username} · View Profile →</div>
            </div>
          </Link>
        </div>

        {/* Stats */}
        <div className={styles.statsRow}>
          <span className={styles.stat}>👁 {listing.views} views</span>
          <span className={styles.stat}>❤️ {listing.likes} likes</span>
        </div>
      </div>

      {/* Sticky Checkout Button */}
      {!isOwnListing && listing.status === "active" && (
        <div className={styles.stickyBar}>
          <div className={styles.stickyPrice}>{Number(listing.price_pi).toFixed(2)} π</div>
          <button className={styles.buyBtn} onClick={() => setShowCheckout(true)}>
            Buy Now 🛒
          </button>
        </div>
      )}

      {isOwnListing && (
        <div className={styles.stickyBar}>
          <span className={styles.ownListingNote}>This is your listing</span>
          <Link href="/market/my-listings" className={styles.manageBtn}>Manage →</Link>
        </div>
      )}

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
                  <button className={styles.nextBtn} onClick={() => setCheckoutStep("details")}>Continue →</button>
                </>
              )}

              {checkoutStep === "details" && (
                <>
                  <div className={styles.stepTitle}>{buyMethod === "ship" ? "Shipping Details" : "Meetup Details"}</div>
                  {buyMethod === "ship" ? (
                    <>
                      {[
                        { key: "shipping_name",     label: "Full Name",    type: "text",  placeholder: "Your full name" },
                        { key: "shipping_address",  label: "Address",      type: "text",  placeholder: "Street address" },
                        { key: "shipping_city",     label: "City",         type: "text",  placeholder: "Kuala Lumpur" },
                        { key: "shipping_postcode", label: "Postcode",     type: "text",  placeholder: "50000" },
                        { key: "shipping_country",  label: "Country",      type: "text",  placeholder: "Malaysia" },
                      ].map(f => (
                        <div key={f.key} className={styles.formField}>
                          <label className={styles.formLabel}>{f.label}</label>
                          <input className={styles.formInput} type={f.type} placeholder={f.placeholder}
                            value={form[f.key as keyof typeof form]}
                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Preferred Meetup Location</label>
                      <input className={styles.formInput} placeholder="e.g. Midvalley LRT, KL" value={form.meetup_location}
                        onChange={e => setForm(prev => ({ ...prev, meetup_location: e.target.value }))} />
                    </div>
                  )}
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Notes to Seller (optional)</label>
                    <textarea className={styles.formInput} rows={2} placeholder="Any special request..."
                      value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
                  </div>
                  <div className={styles.btnRow}>
                    <button className={styles.backStep} onClick={() => setCheckoutStep("method")}>← Back</button>
                    <button className={styles.nextBtn} onClick={() => setCheckoutStep("confirm")}>Review Order →</button>
                  </div>
                </>
              )}

              {checkoutStep === "confirm" && (
                <>
                  <div className={styles.stepTitle}>Review & Pay</div>
                  <div className={styles.confirmBox}>
                    <div className={styles.confirmRow}><span>Method</span><strong>{buyMethod === "ship" ? "📦 Shipping" : "📍 Meetup"}</strong></div>
                    {buyMethod === "ship" && <>
                      <div className={styles.confirmRow}><span>Deliver to</span><strong>{form.shipping_name}</strong></div>
                      <div className={styles.confirmRow}><span>Address</span><strong>{form.shipping_address}, {form.shipping_city} {form.shipping_postcode}</strong></div>
                    </>}
                    {buyMethod === "meetup" && form.meetup_location && (
                      <div className={styles.confirmRow}><span>Location</span><strong>{form.meetup_location}</strong></div>
                    )}
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
                    <button className={styles.backStep} onClick={() => setCheckoutStep("details")}>← Back</button>
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
    </div>
  );
}