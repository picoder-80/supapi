"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./page.module.css";
import { formatListingCategoryPath } from "@/lib/market/categories";

interface Order {
  id: string; status: string; buying_method: string; amount_pi: number;
  shipping_name: string; shipping_address: string; shipping_city: string;
  shipping_postcode: string; shipping_country: string;
  meetup_location: string; meetup_time: string;
  tracking_number: string; tracking_carrier?: string;
  notes: string; pi_payment_id: string;
  created_at: string; updated_at: string;
  has_review?: boolean;
  listing: { id: string; title: string; images: string[]; price_pi: number; description: string; location: string; category: string; subcategory?: string; category_deep?: string | null } | null;
  buyer:  { id: string; username: string; display_name: string | null; avatar_url: string | null; phone: string; email: string };
  seller: { id: string; username: string; display_name: string | null; avatar_url: string | null; phone: string };
  disputes: { id: string; reason: string; evidence?: string[]; status: string; ai_decision: string; ai_reasoning: string; ai_confidence: number; created_at: string }[];
  return_request?: {
    id: string;
    status: string;
    category: string;
    reason: string;
    evidence?: unknown;
    seller_note?: string | null;
    seller_response_deadline: string;
    seller_responded_at?: string | null;
  } | null;
}

const STATUS_STEPS = ["pending","paid","shipped","delivered","completed"];
const STATUS_LABELS: Record<string,string> = {
  pending:"Pending Payment", escrow:"Payment Confirmed", paid:"Payment Confirmed", shipped:"Shipped",
  meetup_set:"Meetup Arranged", delivered:"Delivered", completed:"Completed",
  disputed:"Under Dispute", refunded:"Refunded", cancelled:"Cancelled",
};

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }
function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-MY", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}
function extractEvidenceUrls(input: unknown): string[] {
  if (!input) return [];
  const list = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? [input]
      : [];
  return list
    .map((v) => String(v ?? "").trim())
    .filter((v) => /^https?:\/\//i.test(v));
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router   = useRouter();

  const [order, setOrder]         = useState<Order | null>(null);
  const [loading, setLoading]     = useState(true);
  const [updating, setUpdating]   = useState(false);
  const [trackingInput, setTrackingInput] = useState("");
  const [courierInput, setCourierInput] = useState("");
  const [meetupInput, setMeetupInput]     = useState("");
  const [showDispute, setShowDispute]     = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeCategory, setDisputeCategory] = useState("delivery_issue");
  const [disputeExpectedOutcome, setDisputeExpectedOutcome] = useState<"refund" | "manual_review">("refund");
  const [incidentDate, setIncidentDate] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [dragOverEvidence, setDragOverEvidence] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number; current: string }>({
    done: 0,
    total: 0,
    current: "",
  });
  const [disputing, setDisputing] = useState(false);
  const [disputeResult, setDisputeResult] = useState<any>(null);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [showEscalateForm, setShowEscalateForm] = useState(false);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [sellerReturnNote, setSellerReturnNote] = useState("");
  const [msg, setMsg]             = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewImageUrls, setReviewImageUrls] = useState<string[]>([]);
  const [reviewUploading, setReviewUploading] = useState(false);
  const [reviewUploadProgress, setReviewUploadProgress] = useState<{ done: number; total: number; current: string }>({
    done: 0,
    total: 0,
    current: "",
  });
  const MAX_REVIEW_PHOTOS = 4;

  const fetchOrder = async () => {
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/supamarket/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.success) {
        setOrder(d.data);
        setTrackingInput(d.data.tracking_number ?? "");
        setCourierInput(d.data.tracking_carrier ?? "");
        setMeetupInput(d.data.meetup_location ?? "");
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { if (user) fetchOrder(); }, [user, id]);

  const updateStatus = async (newStatus: string, extra?: Record<string, string>) => {
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    setUpdating(true); setMsg("");
    try {
      const r = await fetch(`/api/supamarket/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus, ...extra }),
      });
      const d = await r.json();
      if (d.success) { setOrder(d.data); setMsg("Updated!"); setTimeout(() => setMsg(""), 2500); }
      else setMsg(d.error ?? "Update failed");
    } catch { setMsg("Something went wrong"); }
    setUpdating(false);
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) return;
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    setDisputing(true);
    const evidencePayload = [
      ...evidenceUrls,
      `Case category: ${disputeCategory}`,
      `Preferred outcome: ${disputeExpectedOutcome}`,
      ...(incidentDate ? [`Incident date: ${incidentDate}`] : []),
    ];

    const returnRequestId =
      order?.return_request?.status === "seller_rejected" ? order.return_request.id : undefined;

    try {
      const r = await fetch("/api/supamarket/dispute", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          order_id: id,
          reason: disputeReason,
          evidence: evidencePayload,
          ...(returnRequestId ? { return_request_id: returnRequestId } : {}),
        }),
      });
      const d = await r.json();
      if (d.success) {
        setDisputeResult(d.data);
        setShowEscalateForm(false);
        if (!d.data?.auto_resolved) {
          setMsg("Case submitted. Our team will review and resolve it shortly.");
        }
        await fetchOrder();
      }
      else setMsg(d.error ?? "Dispute failed");
    } catch { setMsg("Something went wrong"); }
    setDisputing(false);
  };

  const uploadEvidenceFiles = async (filesInput: FileList | File[] | null) => {
    if (!filesInput || filesInput.length === 0) return;
    if (evidenceUrls.length >= 6) {
      setMsg("Maximum 6 evidence images");
      return;
    }
    const token = localStorage.getItem("supapi_token");
    if (!token) return;

    const allowedTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
    const uploadList = Array.from(filesInput)
      .filter((f) => allowedTypes.has(String(f.type).toLowerCase()))
      .slice(0, Math.max(0, 6 - evidenceUrls.length));
    if (!uploadList.length) {
      setMsg("Only JPEG, PNG, or WEBP images are allowed");
      return;
    }
    setUploadingEvidence(true);
    setUploadProgress({ done: 0, total: uploadList.length, current: "" });
    setMsg("");
    try {
      for (let i = 0; i < uploadList.length; i += 1) {
        const file = uploadList[i];
        setUploadProgress({ done: i, total: uploadList.length, current: file.name });
        const fd = new FormData();
        fd.append("order_id", id);
        fd.append("image", file);
        const r = await fetch("/api/supamarket/dispute/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const d = await r.json();
        if (!d?.success || !d?.data?.url) {
          setMsg(d?.error ?? "Evidence upload failed");
          continue;
        }
        setEvidenceUrls((prev) => [...prev, String(d.data.url)].slice(0, 6));
      }
    } catch {
      setMsg("Evidence upload failed");
    }
    setUploadProgress((prev) => ({ ...prev, done: prev.total, current: "" }));
    setUploadingEvidence(false);
  };

  const handleEvidenceDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOverEvidence(false);
    await uploadEvidenceFiles(e.dataTransfer?.files ?? null);
  };

  const uploadReviewPhotos = async (filesInput: FileList | File[] | null) => {
    if (!filesInput || filesInput.length === 0) return;
    if (reviewImageUrls.length >= MAX_REVIEW_PHOTOS) {
      setMsg(`Maximum ${MAX_REVIEW_PHOTOS} photos`);
      return;
    }
    const token = localStorage.getItem("supapi_token");
    if (!token) return;

    const allowedTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
    const uploadList = Array.from(filesInput)
      .filter((f) => allowedTypes.has(String(f.type).toLowerCase()))
      .slice(0, Math.max(0, MAX_REVIEW_PHOTOS - reviewImageUrls.length));
    if (!uploadList.length) {
      setMsg("Only JPEG, PNG, or WEBP images are allowed");
      return;
    }
    setReviewUploading(true);
    setReviewUploadProgress({ done: 0, total: uploadList.length, current: "" });
    setMsg("");
    try {
      for (let i = 0; i < uploadList.length; i += 1) {
        const file = uploadList[i];
        setReviewUploadProgress({ done: i, total: uploadList.length, current: file.name });
        const fd = new FormData();
        fd.append("image", file);
        const r = await fetch(`/api/supamarket/orders/${id}/review/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const d = await r.json();
        if (!d?.success || !d?.data?.url) {
          setMsg(d?.error ?? "Photo upload failed");
          continue;
        }
        setReviewImageUrls((prev) => [...prev, String(d.data.url)].slice(0, MAX_REVIEW_PHOTOS));
      }
    } catch {
      setMsg("Photo upload failed");
    }
    setReviewUploadProgress((prev) => ({ ...prev, done: prev.total, current: "" }));
    setReviewUploading(false);
  };

  const submitReturnRequest = async () => {
    const token = localStorage.getItem("supapi_token");
    if (!token || !disputeReason.trim()) return;
    setReturnSubmitting(true);
    setMsg("");
    try {
      const r = await fetch(`/api/supamarket/orders/${id}/return-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          category: disputeCategory,
          reason: disputeReason,
          evidence: [...evidenceUrls, ...(incidentDate ? [`Incident date: ${incidentDate}`] : [])],
        }),
      });
      const d = await r.json();
      if (d.success) {
        setMsg("Return / refund request sent. The seller will respond soon.");
        setShowReturnForm(false);
        setDisputeReason("");
        setEvidenceUrls([]);
        setIncidentDate("");
        await fetchOrder();
      } else setMsg(d.error ?? "Could not submit request");
    } catch {
      setMsg("Something went wrong");
    }
    setReturnSubmitting(false);
  };

  const cancelReturnRequest = async () => {
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    const ok = typeof window === "undefined"
      ? true
      : window.confirm("Withdraw this return request? You can submit a new one later if needed.");
    if (!ok) return;
    setReturnSubmitting(true);
    setMsg("");
    try {
      const r = await fetch(`/api/supamarket/orders/${id}/return-request`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.success) {
        setMsg("Return request withdrawn.");
        await fetchOrder();
      } else setMsg(d.error ?? "Could not withdraw request");
    } catch {
      setMsg("Something went wrong");
    }
    setReturnSubmitting(false);
  };

  const respondReturn = async (accept: boolean) => {
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    if (!accept && !sellerReturnNote.trim()) {
      setMsg("Add a short note when declining.");
      return;
    }
    setReturnSubmitting(true);
    setMsg("");
    try {
      const r = await fetch(`/api/supamarket/orders/${id}/return-request/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accept, note: sellerReturnNote.trim() }),
      });
      const d = await r.json();
      if (d.success) {
        setMsg(accept ? "You agreed to refund this order." : "You declined the return request.");
        setSellerReturnNote("");
        await fetchOrder();
      } else setMsg(d.error ?? "Could not respond");
    } catch {
      setMsg("Something went wrong");
    }
    setReturnSubmitting(false);
  };

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Order Detail", url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // user cancelled share flow
    }
  };

  const renderTopBar = () => (
    <header className={styles.topBar}>
      <button className={styles.iconBtn} onClick={() => router.push("/supamarket/orders")} aria-label="Back to orders">←</button>
      <h1 className={styles.title}>Order Detail</h1>
      <button className={styles.iconBtn} onClick={handleShare} aria-label="Share">⤴</button>
    </header>
  );

  if (!user) return (
    <div className={styles.page}>
      {renderTopBar()}
      <div className={styles.stateWrap}>
        <div className={styles.stateCard}>
          <div className={styles.authIcon}>🔒</div>
          <div className={styles.authTitle}>Sign in required</div>
          <button className={styles.authBtn} onClick={() => router.push("/dashboard")}>Sign In with Pi</button>
        </div>
      </div>
    </div>
  );

  if (loading) return (
    <div className={styles.page}>
      {renderTopBar()}
      <div className={styles.body}>
        <div className={styles.skeletonHero} />
        <div className={styles.skeletonCard} />
        <div className={styles.skeletonCard} />
        <div className={styles.skeletonCard} />
      </div>
    </div>
  );
  if (!order)  return (
    <div className={styles.page}>
      {renderTopBar()}
      <div className={styles.stateWrap}>
        <div className={styles.stateCard}>
          <div className={styles.authIcon}>📭</div>
          <div className={styles.authTitle}>Order not found</div>
          <Link href="/supamarket/orders" className={styles.backLink}>← Back to Orders</Link>
        </div>
      </div>
    </div>
  );

  const isBuyer  = user.id === order.buyer?.id;
  const isSeller = user.id === order.seller?.id;
  const dispute  = order.disputes?.[0];
  const returnEvidenceUrls = extractEvidenceUrls(order.return_request?.evidence);
  const normalizedStatus = order.status === "escrow" ? "paid" : order.status;
  const stepIdx  = STATUS_STEPS.indexOf(normalizedStatus);
  const isActive = !["completed","refunded","cancelled","disputed"].includes(normalizedStatus);

  return (
    <div className={styles.page}>
      {renderTopBar()}

      {/* Status Banner */}
      <div className={styles.statusBanner} data-status={order.status}>
        <div className={styles.statusEmoji}>
          {order.status === "completed" ? "🎉" : order.status === "disputed" ? "⚠️" : order.status === "refunded" ? "↩️" : order.status === "cancelled" ? "❌" : "📦"}
        </div>
        <div>
          <div className={styles.statusLabel}>{STATUS_LABELS[order.status] ?? order.status}</div>
          <div className={styles.statusTime}>Updated {fmt(order.updated_at)}</div>
        </div>
      </div>

      {/* Progress bar (only for active linear statuses) */}
      {isActive && stepIdx >= 0 && order.buying_method !== "meetup" && (
        <div className={styles.progress}>
          {STATUS_STEPS.slice(0,5).map((s, i) => (
            <div key={s} className={styles.progressStep}>
              <div className={`${styles.progressDot} ${i <= stepIdx ? styles.progressDotDone : ""}`} />
              {i < 4 && <div className={`${styles.progressLine} ${i < stepIdx ? styles.progressLineDone : ""}`} />}
              <div className={styles.progressLabel}>{["Pending","Paid","Shipped","Delivered","Done"][i]}</div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.body}>
        {msg && <div className={`${styles.msg} ${msg === "Updated!" ? styles.msgSuccess : styles.msgError}`}>{msg}</div>}

        {/* Listing */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Item</div>
          {order.listing ? (
            <Link href={`/supamarket/${order.listing.id}`} className={styles.listingCard}>
              {order.listing.images?.[0] && <img src={order.listing.images[0]} alt="" className={styles.listingImg} />}
              <div className={styles.listingInfo}>
                <div className={styles.listingTitle}>{order.listing.title}</div>
                <div className={styles.listingPrice}>{Number(order.amount_pi).toFixed(2)} π</div>
                <div className={styles.listingCat}>{formatListingCategoryPath(order.listing.category, order.listing.subcategory ?? "", order.listing.category_deep)} · {order.buying_method === "ship" ? "📦 Shipping" : "📍 Meetup"}</div>
              </div>
            </Link>
          ) : <div className={styles.removedNote}>Listing has been removed</div>}
        </div>

        {/* Delivery / Meetup Info */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{order.buying_method === "ship" ? "Delivery Info" : "Meetup Info"}</div>
          <div className={styles.infoBox}>
            {order.buying_method === "ship" ? (
              <>
                <div className={styles.infoRow}><span>Name</span><strong>{order.shipping_name || "—"}</strong></div>
                <div className={styles.infoRow}><span>Address</span><strong>{order.shipping_address || "—"}</strong></div>
                <div className={styles.infoRow}><span>City</span><strong>{order.shipping_city || "—"}</strong></div>
                <div className={styles.infoRow}><span>Postcode</span><strong>{order.shipping_postcode || "—"}</strong></div>
                <div className={styles.infoRow}><span>Country</span><strong>{order.shipping_country || "United States"}</strong></div>
                {order.tracking_number && (
                  <div className={styles.infoRow}>
                    <span>Tracking</span>
                    <span className={styles.trackingCell}>
                      {order.tracking_carrier && <span className={styles.trackingCarrier}>{order.tracking_carrier}</span>}
                      <strong className={styles.tracking}>{order.tracking_number}</strong>
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className={styles.infoRow}><span>Location</span><strong>{order.meetup_location || "TBD"}</strong></div>
                {order.meetup_time && <div className={styles.infoRow}><span>Time</span><strong>{fmt(order.meetup_time)}</strong></div>}
              </>
            )}
            {order.notes && <div className={styles.infoRow}><span>Notes</span><strong>{order.notes}</strong></div>}
          </div>
        </div>

        {/* Seller actions */}
        {isSeller && (order.status === "paid" || order.status === "escrow") && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{order.buying_method === "ship" ? "📦 Ship This Order" : "📍 Arrange Meetup"}</div>
            {order.buying_method === "ship" ? (
              <>
                <div className={styles.trackingInputWrap}>
                  <input
                    className={styles.input}
                    placeholder="Courier company (e.g. DHL, FedEx, J&T Express, Ninja Van)"
                    value={courierInput}
                    onChange={e => setCourierInput(e.target.value)}
                  />
                  <input
                    className={styles.input}
                    placeholder="Tracking number"
                    value={trackingInput}
                    onChange={e => setTrackingInput(e.target.value)}
                  />
                  <div className={styles.trackingHint}>
                    Add the courier name if you know it — the buyer will use it with the tracking number on the carrier&apos;s site.
                  </div>
                </div>
                <button className={styles.actionBtn} disabled={updating}
                  onClick={() => {
                    const extra: Record<string, string> = {
                      tracking_number: trackingInput.trim(),
                    };
                    if (courierInput.trim()) extra.tracking_carrier = courierInput.trim();
                    updateStatus("shipped", extra);
                  }}>
                  {updating ? "Updating..." : "Mark as Shipped 📦"}
                </button>
              </>
            ) : (
              <>
                <input className={styles.input} placeholder="Confirm meetup location"
                  value={meetupInput} onChange={e => setMeetupInput(e.target.value)} />
                <button className={styles.actionBtn} disabled={updating}
                  onClick={() => updateStatus("meetup_set", { meetup_location: meetupInput })}>
                  {updating ? "Updating..." : "Confirm Meetup 📍"}
                </button>
              </>
            )}
          </div>
        )}

        {/* Buyer confirm delivery */}
        {isBuyer && (order.status === "shipped" || order.status === "meetup_set") && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>✅ Confirm Receipt</div>
            <div className={styles.confirmNote}>
              Once confirmed, you can complete the order to release payment to the seller. If you take no action, receipt
              may be auto-confirmed after several days (see Return &amp; Refund policy).
            </div>
            <button className={styles.confirmBtn} disabled={updating} onClick={() => updateStatus("delivered")}>
              {updating ? "Updating..." : "I've Received This Item ✅"}
            </button>
          </div>
        )}

        {/* Buyer complete */}
        {isBuyer && order.status === "delivered" && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>🎉 Complete Order</div>
            <div className={styles.confirmNote}>
              Happy with your purchase? Mark as complete to finalise payment to the seller. If you do nothing, the order
              may auto-complete after a short period unless a return request is open.
              {order.return_request?.status === "pending_seller" ? (
                <span className={styles.returnWarning}>
                  {" "}
                  You have an open return request — complete the order only after you withdraw it or the seller responds.
                </span>
              ) : null}
            </div>
            <button
              className={styles.confirmBtn}
              disabled={updating || order.return_request?.status === "pending_seller"}
              onClick={() => updateStatus("completed")}
            >
              {updating ? "Updating..." : "Complete Order 🎉"}
            </button>
          </div>
        )}

        {/* Buyer rate seller (completed, not yet reviewed) */}
        {isBuyer && order.status === "completed" && !order.has_review && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>⭐ Rate Seller</div>
            <div className={styles.confirmNote}>How was your experience? Your rating helps other buyers.</div>
            <div className={styles.reviewStars}>
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={styles.reviewStarBtn}
                  onClick={() => setReviewRating(s)}
                  aria-label={`${s} star${s > 1 ? "s" : ""}`}
                >
                  {s <= reviewRating ? "★" : "☆"}
                </button>
              ))}
            </div>
            <textarea
              className={styles.input}
              rows={2}
              placeholder="Optional: Add a comment..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              disabled={reviewSubmitting}
            />
            <div className={styles.reviewPhotosSection}>
              <div className={styles.reviewPhotosLabel}>Photos (optional)</div>
              <div className={styles.reviewPhotosHint}>Up to {MAX_REVIEW_PHOTOS} images · JPEG, PNG, or WEBP · max 8MB each</div>
              <label className={styles.reviewPhotoPick}>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  multiple
                  className={styles.reviewPhotoInput}
                  onChange={(e) => void uploadReviewPhotos(e.target.files)}
                  disabled={reviewSubmitting || reviewUploading || reviewImageUrls.length >= MAX_REVIEW_PHOTOS}
                />
                <span className={styles.reviewPhotoPickBtn}>
                  {reviewUploading ? "Uploading…" : "+ Add photos"}
                </span>
              </label>
              {reviewUploading && (
                <div className={styles.uploading}>
                  Uploading {reviewUploadProgress.done}/{reviewUploadProgress.total}
                  {reviewUploadProgress.current ? ` · ${reviewUploadProgress.current}` : ""}
                </div>
              )}
              {reviewImageUrls.length > 0 && (
                <div className={styles.reviewPhotoGrid}>
                  {reviewImageUrls.map((url) => (
                    <div key={url} className={styles.reviewPhotoItem}>
                      <img src={url} alt="" className={styles.reviewPhotoImg} />
                      <button
                        type="button"
                        className={styles.reviewPhotoRemove}
                        aria-label="Remove photo"
                        disabled={reviewSubmitting || reviewUploading}
                        onClick={() => setReviewImageUrls((prev) => prev.filter((u) => u !== url))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              className={styles.confirmBtn}
              disabled={reviewSubmitting || reviewUploading}
              onClick={async () => {
                const token = localStorage.getItem("supapi_token");
                if (!token) return;
                setReviewSubmitting(true);
                setMsg("");
                try {
                  const r = await fetch(`/api/supamarket/orders/${id}/review`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                      rating: reviewRating,
                      comment: reviewComment || undefined,
                      ...(reviewImageUrls.length ? { images: reviewImageUrls } : {}),
                    }),
                  });
                  const d = await r.json();
                  if (d.success) {
                    setMsg("Thanks for your review!");
                    setReviewImageUrls([]);
                    await fetchOrder();
                  } else setMsg(d.error ?? "Failed to submit review");
                } catch {
                  setMsg("Something went wrong");
                }
                setReviewSubmitting(false);
              }}
            >
              {reviewSubmitting ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        )}

        {/* Counterpart info */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{isBuyer ? "Seller" : "Buyer"}</div>
          <Link href={`/supaspace/${isBuyer ? order.seller?.username : order.buyer?.username}`} className={styles.personCard}>
            <div className={styles.personAvatar}>
              {(isBuyer ? order.seller : order.buyer)?.avatar_url
                ? <img src={(isBuyer ? order.seller : order.buyer)!.avatar_url!} alt="" className={styles.personAvatarImg} />
                : <span>{getInitial((isBuyer ? order.seller : order.buyer)?.username ?? "?")}</span>
              }
            </div>
            <div>
              <div className={styles.personName}>{(isBuyer ? order.seller : order.buyer)?.display_name ?? (isBuyer ? order.seller : order.buyer)?.username}</div>
              <div className={styles.personSub}>@{(isBuyer ? order.seller : order.buyer)?.username} · View Profile →</div>
            </div>
          </Link>
        </div>

        {/* Seller: respond to return / refund request */}
        {isSeller && order.status === "delivered" && order.return_request?.status === "pending_seller" && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>↩️ Return / refund request</div>
            <div className={styles.disputeNote}>
              The buyer asked for a refund. Respond within{" "}
              <strong>{new Date(order.return_request.seller_response_deadline).toLocaleString()}</strong>
              . Agreeing will cancel escrow and mark the order refunded.
            </div>
            <div className={styles.infoBox} style={{ marginBottom: 10 }}>
              <div className={styles.infoRow}>
                <span>Category</span>
                <strong>{order.return_request.category}</strong>
              </div>
              <div className={styles.infoRow}>
                <span>Details</span>
                <strong style={{ whiteSpace: "pre-wrap", fontWeight: 600 }}>{order.return_request.reason}</strong>
              </div>
            </div>
            {returnEvidenceUrls.length > 0 && (
              <div className={styles.resultEvidenceWrap} style={{ marginBottom: 10 }}>
                <div className={styles.resultEvidenceTitle}>Buyer evidence</div>
                <div className={styles.resultEvidenceGrid}>
                  {returnEvidenceUrls.slice(0, 6).map((url) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer" className={styles.resultEvidenceLink}>
                      <img src={url} alt="Buyer evidence" className={styles.resultEvidenceImg} />
                    </a>
                  ))}
                </div>
              </div>
            )}
            <textarea
              className={styles.input}
              rows={2}
              placeholder="Note to buyer (required if you decline)"
              value={sellerReturnNote}
              onChange={(e) => setSellerReturnNote(e.target.value)}
              disabled={returnSubmitting}
            />
            <div className={styles.btnRow}>
              <button
                type="button"
                className={styles.confirmBtn}
                disabled={returnSubmitting}
                onClick={() => void respondReturn(true)}
              >
                {returnSubmitting ? "…" : "Agree & refund buyer"}
              </button>
              <button
                type="button"
                className={styles.disputeOpenBtn}
                disabled={returnSubmitting}
                onClick={() => void respondReturn(false)}
              >
                {returnSubmitting ? "…" : "Decline"}
              </button>
            </div>
          </div>
        )}

        {/* Buyer: return / refund first (replaces direct dispute while delivered) */}
        {isBuyer && order.status === "delivered" && !dispute && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>↩️ Return / refund</div>
            {order.return_request?.status === "pending_seller" ? (
              <>
                <div className={styles.disputeNote}>
                  Waiting for the seller. They should respond by{" "}
                  <strong>{new Date(order.return_request.seller_response_deadline).toLocaleString()}</strong>.
                </div>
                <button
                  type="button"
                  className={styles.withdrawReturnBtn}
                  disabled={returnSubmitting}
                  onClick={() => void cancelReturnRequest()}
                >
                  {returnSubmitting ? "Withdrawing..." : "↩ Withdraw request"}
                </button>
              </>
            ) : order.return_request?.status === "seller_rejected" ? (
              <>
                <div className={styles.disputeNote}>
                  The seller declined your return request
                  {order.return_request.seller_note ? `: ${order.return_request.seller_note}` : "."} You can ask for
                  platform review below.
                </div>
                {!showEscalateForm ? (
                  <button type="button" className={styles.disputeOpenBtn} onClick={() => setShowEscalateForm(true)}>
                    Ask for platform review
                  </button>
                ) : (
                  <>
                    <div className={styles.disputeNote}>
                      Add details and evidence. Our team will review and resolve it shortly.
                    </div>
                    <div className={styles.disputeMetaGrid}>
                      <div className={styles.formField}>
                        <label className={styles.formLabel}>Issue Category</label>
                        <select
                          className={styles.input}
                          value={disputeCategory}
                          onChange={(e) => setDisputeCategory(e.target.value)}
                        >
                          <option value="delivery_issue">Delivery issue</option>
                          <option value="item_not_as_described">Item not as described</option>
                          <option value="damaged_item">Damaged item</option>
                          <option value="wrong_item">Wrong item</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className={styles.formField}>
                        <label className={styles.formLabel}>Preferred Outcome</label>
                        <select
                          className={styles.input}
                          value={disputeExpectedOutcome}
                          onChange={(e) =>
                            setDisputeExpectedOutcome(e.target.value as "refund" | "manual_review")
                          }
                        >
                          <option value="refund">Refund</option>
                          <option value="manual_review">Manual review</option>
                        </select>
                      </div>
                    </div>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Incident Date (optional)</label>
                      <input
                        className={styles.input}
                        type="date"
                        value={incidentDate}
                        onChange={(e) => setIncidentDate(e.target.value)}
                      />
                    </div>
                    <textarea
                      className={styles.input}
                      rows={4}
                      placeholder="Explain what happened and what you expect..."
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                    />
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Evidence Photos (up to 6)</label>
                      <div
                        className={`${styles.dropZone} ${dragOverEvidence ? styles.dropZoneActive : ""}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverEvidence(true);
                        }}
                        onDragLeave={() => setDragOverEvidence(false)}
                        onDrop={handleEvidenceDrop}
                      >
                        <div className={styles.dropZoneTitle}>Drop images here or choose files</div>
                        <div className={styles.dropZoneSub}>Accepted: JPEG, PNG, WEBP</div>
                        <input
                          className={styles.fileInput}
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          multiple
                          onChange={(e) => uploadEvidenceFiles(e.target.files)}
                          disabled={uploadingEvidence || evidenceUrls.length >= 6}
                        />
                      </div>
                      {uploadingEvidence && (
                        <div className={styles.uploading}>
                          Uploading {uploadProgress.done}/{uploadProgress.total}
                          {uploadProgress.current ? ` · ${uploadProgress.current}` : ""}
                        </div>
                      )}
                      {evidenceUrls.length > 0 && (
                        <div className={styles.evidenceGrid}>
                          {evidenceUrls.map((url) => (
                            <div key={url} className={styles.evidenceItem}>
                              <img src={url} alt="" className={styles.evidenceImg} />
                              <button
                                type="button"
                                className={styles.removeEvidenceBtn}
                                onClick={() => setEvidenceUrls((prev) => prev.filter((v) => v !== url))}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className={styles.btnRow}>
                      <button type="button" className={styles.cancelBtn} onClick={() => setShowEscalateForm(false)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={styles.disputeBtn}
                        disabled={disputing || uploadingEvidence || !disputeReason.trim()}
                        onClick={() => void handleDispute()}
                      >
                        {disputing ? "Submitting..." : "Submit for review"}
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <div className={styles.disputeNote}>
                  Ask the seller for a refund first. If they decline, you can request platform review. This helps
                  resolve issues quickly and reduces mistaken claims.
                </div>
                {!showReturnForm ? (
                  <button type="button" className={styles.disputeOpenBtn} onClick={() => setShowReturnForm(true)}>
                    Request return / refund
                  </button>
                ) : (
                  <>
                    <div className={styles.disputeMetaGrid}>
                      <div className={styles.formField}>
                        <label className={styles.formLabel}>Issue Category</label>
                        <select
                          className={styles.input}
                          value={disputeCategory}
                          onChange={(e) => setDisputeCategory(e.target.value)}
                        >
                          <option value="delivery_issue">Delivery issue</option>
                          <option value="item_not_as_described">Item not as described</option>
                          <option value="damaged_item">Damaged item</option>
                          <option value="wrong_item">Wrong item</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Incident Date (optional)</label>
                      <input
                        className={styles.input}
                        type="date"
                        value={incidentDate}
                        onChange={(e) => setIncidentDate(e.target.value)}
                      />
                    </div>
                    <textarea
                      className={styles.input}
                      rows={4}
                      placeholder="Describe the problem clearly..."
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                    />
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Photos (up to 6, recommended)</label>
                      <div
                        className={`${styles.dropZone} ${dragOverEvidence ? styles.dropZoneActive : ""}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverEvidence(true);
                        }}
                        onDragLeave={() => setDragOverEvidence(false)}
                        onDrop={handleEvidenceDrop}
                      >
                        <div className={styles.dropZoneTitle}>Drop images here or choose files</div>
                        <div className={styles.dropZoneSub}>JPEG, PNG, WEBP</div>
                        <input
                          className={styles.fileInput}
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          multiple
                          onChange={(e) => uploadEvidenceFiles(e.target.files)}
                          disabled={uploadingEvidence || evidenceUrls.length >= 6}
                        />
                      </div>
                      {uploadingEvidence && (
                        <div className={styles.uploading}>
                          Uploading {uploadProgress.done}/{uploadProgress.total}
                          {uploadProgress.current ? ` · ${uploadProgress.current}` : ""}
                        </div>
                      )}
                      {evidenceUrls.length > 0 && (
                        <div className={styles.evidenceGrid}>
                          {evidenceUrls.map((url) => (
                            <div key={url} className={styles.evidenceItem}>
                              <img src={url} alt="" className={styles.evidenceImg} />
                              <button
                                type="button"
                                className={styles.removeEvidenceBtn}
                                onClick={() => setEvidenceUrls((prev) => prev.filter((v) => v !== url))}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className={styles.btnRow}>
                      <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={() => {
                          setShowReturnForm(false);
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={styles.disputeBtn}
                        disabled={returnSubmitting || uploadingEvidence || !disputeReason.trim()}
                        onClick={() => void submitReturnRequest()}
                      >
                        {returnSubmitting ? "Sending..." : "Send to seller"}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Seller: platform case (no pending return request on this order) */}
        {(order.status === "delivered" || order.status === "disputed") &&
          isSeller &&
          !dispute &&
          order.return_request?.status !== "pending_seller" && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>⚠️ Open a case</div>
            <div className={styles.disputeNote}>If you need platform help on this order, open a case with details.</div>
            {!showDispute ? (
              <button className={styles.disputeOpenBtn} onClick={() => setShowDispute(true)}>
                Open case
              </button>
            ) : (
              <>
                <div className={styles.disputeMetaGrid}>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Issue Category</label>
                    <select className={styles.input} value={disputeCategory} onChange={(e) => setDisputeCategory(e.target.value)}>
                      <option value="delivery_issue">Delivery issue</option>
                      <option value="item_not_as_described">Item not as described</option>
                      <option value="damaged_item">Damaged item</option>
                      <option value="wrong_item">Wrong item</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Preferred Outcome</label>
                    <select
                      className={styles.input}
                      value={disputeExpectedOutcome}
                      onChange={(e) => setDisputeExpectedOutcome(e.target.value as "refund" | "manual_review")}
                    >
                      <option value="refund">Refund</option>
                      <option value="manual_review">Manual review</option>
                    </select>
                  </div>
                </div>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Incident Date (optional)</label>
                  <input
                    className={styles.input}
                    type="date"
                    value={incidentDate}
                    onChange={(e) => setIncidentDate(e.target.value)}
                  />
                </div>
                <textarea
                  className={styles.input}
                  rows={4}
                  placeholder="Describe the situation..."
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                />
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Evidence Photos (up to 6)</label>
                  <div
                    className={`${styles.dropZone} ${dragOverEvidence ? styles.dropZoneActive : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverEvidence(true);
                    }}
                    onDragLeave={() => setDragOverEvidence(false)}
                    onDrop={handleEvidenceDrop}
                  >
                    <div className={styles.dropZoneTitle}>Drop images here or choose files</div>
                    <div className={styles.dropZoneSub}>Accepted: JPEG, PNG, WEBP</div>
                    <input
                      className={styles.fileInput}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      multiple
                      onChange={(e) => uploadEvidenceFiles(e.target.files)}
                      disabled={uploadingEvidence || evidenceUrls.length >= 6}
                    />
                  </div>
                  {uploadingEvidence && (
                    <div className={styles.uploading}>
                      Uploading {uploadProgress.done}/{uploadProgress.total}
                      {uploadProgress.current ? ` · ${uploadProgress.current}` : ""}
                    </div>
                  )}
                  {evidenceUrls.length > 0 && (
                    <div className={styles.evidenceGrid}>
                      {evidenceUrls.map((url) => (
                        <div key={url} className={styles.evidenceItem}>
                          <img src={url} alt="" className={styles.evidenceImg} />
                          <button
                            type="button"
                            className={styles.removeEvidenceBtn}
                            onClick={() => setEvidenceUrls((prev) => prev.filter((v) => v !== url))}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className={styles.btnRow}>
                  <button className={styles.cancelBtn} onClick={() => setShowDispute(false)}>
                    Cancel
                  </button>
                  <button
                    className={styles.disputeBtn}
                    disabled={disputing || uploadingEvidence || !disputeReason.trim()}
                    onClick={() => void handleDispute()}
                  >
                    {disputing ? "Submitting..." : "Submit"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Dispute result */}
        {(dispute || disputeResult) && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>⚖️ Dispute Result</div>
            <div className={`${styles.disputeResult} ${
              (disputeResult?.decision ?? dispute?.ai_decision) === "refund"
                ? styles.disputeRefund
                : (disputeResult?.decision ?? dispute?.ai_decision) === "manual_review"
                  ? styles.disputeManual
                  : styles.disputeRelease
            }`}>
              <div className={styles.disputeDecision}>
                {(disputeResult?.decision ?? dispute?.ai_decision) === "refund"
                  ? "↩️ Refund Approved"
                  : (disputeResult?.decision ?? dispute?.ai_decision) === "manual_review"
                    ? "🕵️ Manual Review Required"
                    : "✅ Payment Released to Seller"}
              </div>
              <div className={styles.disputeReasoning}>{disputeResult?.reasoning ?? dispute?.ai_reasoning}</div>
              {(disputeResult?.confidence ?? dispute?.ai_confidence) && (
                <div className={styles.disputeConfidence}>Confidence: {Math.round((disputeResult?.confidence ?? dispute?.ai_confidence) * 100)}%</div>
              )}
              {!!dispute?.evidence?.length && (
                <div className={styles.resultEvidenceWrap}>
                  <div className={styles.resultEvidenceTitle}>Submitted evidence</div>
                  <div className={styles.resultEvidenceGrid}>
                    {dispute.evidence.filter((item) => /^https?:\/\//i.test(item)).slice(0, 6).map((url) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" className={styles.resultEvidenceLink}>
                        <img src={url} alt="Evidence" className={styles.resultEvidenceImg} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Order metadata */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Order Info</div>
          <div className={styles.infoBox}>
            <div className={styles.infoRow}><span>Order ID</span><strong className={styles.orderId}>{order.id.slice(0,8)}...</strong></div>
            <div className={styles.infoRow}><span>Placed</span><strong>{fmt(order.created_at)}</strong></div>
            {order.pi_payment_id && <div className={styles.infoRow}><span>Payment ID</span><strong className={styles.orderId}>{order.pi_payment_id.slice(0,12)}...</strong></div>}
            <div className={styles.infoRow}><span>Escrow</span><strong>🔒 Pi Network Escrow</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}