"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { detectTracking } from "@/lib/market/tracking-detect";
import styles from "./page.module.css";

interface Order {
  id: string; status: string; buying_method: string; amount_pi: number;
  shipping_name: string; shipping_address: string; shipping_city: string;
  shipping_postcode: string; shipping_country: string;
  meetup_location: string; meetup_time: string;
  tracking_number: string; tracking_carrier?: string; tracking_url?: string;
  notes: string; pi_payment_id: string;
  created_at: string; updated_at: string;
  listing: { id: string; title: string; images: string[]; price_pi: number; description: string; location: string; category: string } | null;
  buyer:  { id: string; username: string; display_name: string | null; avatar_url: string | null; phone: string; email: string };
  seller: { id: string; username: string; display_name: string | null; avatar_url: string | null; phone: string };
  disputes: { id: string; reason: string; evidence?: string[]; status: string; ai_decision: string; ai_reasoning: string; ai_confidence: number; created_at: string }[];
}

interface SupportTriageResult {
  category: "payment" | "delivery" | "refund" | "account" | "dispute" | "general";
  priority: "low" | "medium" | "high" | "urgent";
  suggested_reply: string;
  recommended_actions: string[];
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
  const [disputeExpectedOutcome, setDisputeExpectedOutcome] = useState<"refund" | "release" | "manual_review">("refund");
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
  const [supportText, setSupportText] = useState("");
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportResult, setSupportResult] = useState<SupportTriageResult | null>(null);
  const [msg, setMsg]             = useState("");

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

    try {
      const r = await fetch("/api/supamarket/dispute", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_id: id, reason: disputeReason, evidence: evidencePayload }),
      });
      const d = await r.json();
      if (d.success) {
        setDisputeResult(d.data);
        if (!d.data?.auto_resolved) {
          setMsg("Dispute submitted. Waiting for admin/manual review.");
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

  const handleSupportTriage = async () => {
    if (!supportText.trim()) return;
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    setSupportLoading(true);
    setSupportResult(null);
    try {
      const r = await fetch("/api/supamarket/ai/support/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: supportText, order_status: order?.status, order_id: id }),
      });
      const d = await r.json();
      if (d.success) setSupportResult(d.data);
      else setMsg(d.error ?? "Support triage failed");
    } catch {
      setMsg("Something went wrong");
    }
    setSupportLoading(false);
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
                <div className={styles.listingCat}>{order.listing.category} · {order.buying_method === "ship" ? "📦 Shipping" : "📍 Meetup"}</div>
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
                      {order.tracking_url && (
                        <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className={styles.trackingLink}>Track →</a>
                      )}
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
                    placeholder="Courier company (e.g. Pos Laju, DHL, FedEx, J&T)"
                    value={courierInput}
                    onChange={e => setCourierInput(e.target.value)}
                  />
                  <input
                    className={styles.input}
                    placeholder="Paste tracking number or full tracking URL (worldwide)"
                    value={trackingInput}
                    onChange={e => setTrackingInput(e.target.value)}
                  />
                  <div className={styles.trackingHint}>Enter courier manually for country-specific carriers; link will still be auto-generated when possible.</div>
                  {trackingInput.trim() && (() => {
                    const detected = detectTracking(trackingInput);
                    return detected ? (
                      <div className={styles.trackingDetected}>
                        <span className={styles.trackingBadge}>{detected.carrier}</span>
                        {detected.trackingUrl && <span className={styles.trackingHint}>→ Track link ready</span>}
                      </div>
                    ) : (
                      <div className={styles.trackingDetected}><span className={styles.trackingHint}>Will save as-is</span></div>
                    );
                  })()}
                </div>
                <button className={styles.actionBtn} disabled={updating}
                  onClick={async () => {
                    const token = localStorage.getItem("supapi_token");
                    if (!token) return;

                    const extra: Record<string, string> = {
                      tracking_number: trackingInput.trim(),
                    };
                    if (courierInput.trim()) extra.tracking_carrier = courierInput.trim();

                    try {
                      const rr = await fetch("/api/supamarket/tracking/resolve", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                          tracking_number: trackingInput.trim(),
                          courier_company: courierInput.trim(),
                        }),
                      });
                      const rd = await rr.json();
                      if (rd?.success && rd?.data) {
                        extra.tracking_number = String(rd.data.tracking_number ?? extra.tracking_number);
                        extra.tracking_carrier = String(rd.data.tracking_carrier ?? extra.tracking_carrier ?? "");
                        if (rd.data.tracking_url) extra.tracking_url = String(rd.data.tracking_url);
                      } else {
                        const detected = detectTracking(trackingInput);
                        if (detected && !extra.tracking_carrier) extra.tracking_carrier = detected.carrier;
                        if (detected?.trackingUrl) extra.tracking_url = detected.trackingUrl;
                      }
                    } catch {
                      const detected = detectTracking(trackingInput);
                      if (detected && !extra.tracking_carrier) extra.tracking_carrier = detected.carrier;
                      if (detected?.trackingUrl) extra.tracking_url = detected.trackingUrl;
                    }

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
            <div className={styles.confirmNote}>Once confirmed, Pi will be released to seller from escrow.</div>
            <button className={styles.confirmBtn} disabled={updating} onClick={() => updateStatus("delivered")}>
              {updating ? "Updating..." : "I've Received This Item ✅"}
            </button>
          </div>
        )}

        {/* Buyer complete */}
        {isBuyer && order.status === "delivered" && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>🎉 Complete Order</div>
            <div className={styles.confirmNote}>Happy with your purchase? Mark as complete to finalise payment.</div>
            <button className={styles.confirmBtn} disabled={updating} onClick={() => updateStatus("completed")}>
              {updating ? "Updating..." : "Complete Order 🎉"}
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

        {/* Dispute section */}
        {(order.status === "delivered" || order.status === "disputed") && isBuyer && !dispute && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>⚠️ Problem with Order?</div>
            {!showDispute ? (
              <button className={styles.disputeOpenBtn} onClick={() => setShowDispute(true)}>Open Dispute</button>
            ) : (
              <>
                <div className={styles.disputeNote}>Describe your issue clearly. Our team will review and resolve it shortly.</div>
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
                      onChange={(e) => setDisputeExpectedOutcome(e.target.value as "refund" | "release" | "manual_review")}
                    >
                      <option value="refund">Refund</option>
                      <option value="release">Release to seller</option>
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
                <textarea className={styles.input} rows={4} placeholder="e.g. Item not received, item damaged, wrong item sent..."
                  value={disputeReason} onChange={e => setDisputeReason(e.target.value)} />
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
                  <div className={styles.inputHint}>
                    Upload screenshots, damaged item photo, delivery proof, or relevant chat proof.
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
                          <img src={url} alt="Dispute evidence" className={styles.evidenceImg} />
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
                  <button className={styles.cancelBtn} onClick={() => setShowDispute(false)}>Cancel</button>
                  <button className={styles.disputeBtn} disabled={disputing || uploadingEvidence || !disputeReason.trim()} onClick={handleDispute}>
                    {disputing ? "Submitting..." : "Submit Dispute"}
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

        {/* AI support triage */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Support Assistant</div>
          <div className={styles.disputeNote}>Need help quickly? Describe your issue and get instant support routing.</div>
          <textarea
            className={styles.input}
            rows={3}
            placeholder="Example: I already paid but seller has not shipped for 3 days..."
            value={supportText}
            onChange={(e) => setSupportText(e.target.value)}
          />
          <button className={styles.actionBtn} disabled={supportLoading || !supportText.trim()} onClick={handleSupportTriage}>
            {supportLoading ? "Checking..." : "Get support routing"}
          </button>
          {supportResult && (
            <div className={styles.supportResult}>
              <div><strong>Category:</strong> {supportResult.category}</div>
              <div><strong>Priority:</strong> {supportResult.priority}</div>
              <div><strong>Suggested Reply:</strong> {supportResult.suggested_reply}</div>
              {supportResult.recommended_actions?.length > 0 && (
                <div><strong>Actions:</strong> {supportResult.recommended_actions.join(", ")}</div>
              )}
            </div>
          )}
        </div>

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