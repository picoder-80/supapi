"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./page.module.css";

interface Order {
  id: string; status: string; buying_method: string; amount_pi: number;
  shipping_name: string; shipping_address: string; shipping_city: string;
  shipping_postcode: string; shipping_country: string;
  meetup_location: string; meetup_time: string;
  tracking_number: string; notes: string; pi_payment_id: string;
  created_at: string; updated_at: string;
  listing: { id: string; title: string; images: string[]; price_pi: number; description: string; location: string; category: string } | null;
  buyer:  { id: string; username: string; display_name: string | null; avatar_url: string | null; phone: string; email: string };
  seller: { id: string; username: string; display_name: string | null; avatar_url: string | null; phone: string };
  disputes: { id: string; reason: string; status: string; ai_decision: string; ai_reasoning: string; ai_confidence: number; created_at: string }[];
}

const STATUS_STEPS = ["pending","paid","shipped","delivered","completed"];
const STATUS_LABELS: Record<string,string> = {
  pending:"Pending Payment", paid:"Payment Confirmed", shipped:"Shipped",
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
  const [meetupInput, setMeetupInput]     = useState("");
  const [showDispute, setShowDispute]     = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputing, setDisputing] = useState(false);
  const [disputeResult, setDisputeResult] = useState<any>(null);
  const [msg, setMsg]             = useState("");

  const fetchOrder = async () => {
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/market/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.success) {
        setOrder(d.data);
        setTrackingInput(d.data.tracking_number ?? "");
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
      const r = await fetch(`/api/market/orders/${id}`, {
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
    try {
      const r = await fetch("/api/market/dispute", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_id: id, reason: disputeReason }),
      });
      const d = await r.json();
      if (d.success) { setDisputeResult(d.data); await fetchOrder(); }
      else setMsg(d.error ?? "Dispute failed");
    } catch { setMsg("Something went wrong"); }
    setDisputing(false);
  };

  if (!user) return (
    <div className={styles.authWall}>
      <div className={styles.authIcon}>🔒</div>
      <div className={styles.authTitle}>Sign in required</div>
      <button className={styles.authBtn} onClick={() => router.push("/dashboard")}>Sign In with Pi</button>
    </div>
  );

  if (loading) return <div className={styles.loading}><div className={styles.spinner}>⏳</div><div>Loading order...</div></div>;
  if (!order)  return <div className={styles.loading}><div>Order not found</div><Link href="/market/orders" className={styles.backLink}>← Back to Orders</Link></div>;

  const isBuyer  = user.id === order.buyer?.id;
  const isSeller = user.id === order.seller?.id;
  const dispute  = order.disputes?.[0];
  const stepIdx  = STATUS_STEPS.indexOf(order.status);
  const isActive = !["completed","refunded","cancelled","disputed"].includes(order.status);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.push("/market/orders")}>← Orders</button>
        <h1 className={styles.title}>Order Detail</h1>
        <div />
      </div>

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
            <Link href={`/market/${order.listing.id}`} className={styles.listingCard}>
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
                <div className={styles.infoRow}><span>Country</span><strong>{order.shipping_country || "Malaysia"}</strong></div>
                {order.tracking_number && (
                  <div className={styles.infoRow}><span>Tracking</span><strong className={styles.tracking}>{order.tracking_number}</strong></div>
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
        {isSeller && order.status === "paid" && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{order.buying_method === "ship" ? "📦 Ship This Order" : "📍 Arrange Meetup"}</div>
            {order.buying_method === "ship" ? (
              <>
                <input className={styles.input} placeholder="Tracking number (optional)"
                  value={trackingInput} onChange={e => setTrackingInput(e.target.value)} />
                <button className={styles.actionBtn} disabled={updating}
                  onClick={() => updateStatus("shipped", { tracking_number: trackingInput })}>
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
          <Link href={`/myspace/${isBuyer ? order.seller?.username : order.buyer?.username}`} className={styles.personCard}>
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
                <div className={styles.disputeNote}>Describe your issue clearly. Our AI will review and make a decision automatically.</div>
                <textarea className={styles.input} rows={4} placeholder="e.g. Item not received, item damaged, wrong item sent..."
                  value={disputeReason} onChange={e => setDisputeReason(e.target.value)} />
                <div className={styles.btnRow}>
                  <button className={styles.cancelBtn} onClick={() => setShowDispute(false)}>Cancel</button>
                  <button className={styles.disputeBtn} disabled={disputing || !disputeReason.trim()} onClick={handleDispute}>
                    {disputing ? "AI Reviewing..." : "Submit Dispute"}
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
            <div className={`${styles.disputeResult} ${(disputeResult?.decision ?? dispute?.ai_decision) === "refund" ? styles.disputeRefund : styles.disputeRelease}`}>
              <div className={styles.disputeDecision}>
                {(disputeResult?.decision ?? dispute?.ai_decision) === "refund" ? "↩️ Refund Approved" : "✅ Payment Released to Seller"}
              </div>
              <div className={styles.disputeReasoning}>{disputeResult?.reasoning ?? dispute?.ai_reasoning}</div>
              {(disputeResult?.confidence ?? dispute?.ai_confidence) && (
                <div className={styles.disputeConfidence}>AI Confidence: {Math.round((disputeResult?.confidence ?? dispute?.ai_confidence) * 100)}%</div>
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
