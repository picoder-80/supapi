"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { ensurePaymentReady, createPiPayment, isPiBrowser, getApiBase } from "@/lib/pi/sdk";
import styles from "./page.module.css";
import { formatListingCategoryPath } from "@/lib/market/categories";
import {
  formatBuyerReturnCountdown,
  formatSellerResponseCountdown,
  getReturnPhaseWithDispute,
  returnCategoryLabel,
} from "@/lib/market/return-flow";

interface Order {
  id: string; status: string; buying_method: string; amount_pi: number;
  shipping_name: string; shipping_address: string; shipping_city: string;
  shipping_postcode: string; shipping_country: string;
  meetup_location: string; meetup_time: string;
  tracking_number: string; tracking_carrier?: string;
  notes: string; pi_payment_id: string;
  created_at: string; updated_at: string;
  has_review?: boolean;
  review_reward_claimed?: boolean;
  review_reward_amount?: number;
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
    buyer_return_tracking_number?: string | null;
    buyer_return_tracking_carrier?: string | null;
    buyer_return_note?: string | null;
    buyer_return_shipped_at?: string | null;
    buyer_return_deadline?: string | null;
    seller_confirmed_return_at?: string | null;
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

function normalizeNoteUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t.replace(/^\/+/, "")}`;
}

/** Pulls structured lines from order notes; remaining lines are buyer freeform. */
function parseOrderNotes(notes: string) {
  const lines = String(notes ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let meetupBuyerPhone = "";
  let directionsUrl = "";
  let digitalContact = "";
  const freeform: string[] = [];
  for (const line of lines) {
    if (/^meetup buyer phone:/i.test(line)) {
      meetupBuyerPhone = line.replace(/^meetup buyer phone:\s*/i, "").trim();
    } else if (/^directions:/i.test(line)) {
      directionsUrl = normalizeNoteUrl(line.replace(/^directions:\s*/i, "").trim());
    } else if (/^digital contact:/i.test(line)) {
      digitalContact = line.replace(/^digital contact:\s*/i, "").trim();
    } else {
      freeform.push(line);
    }
  }
  return {
    meetupBuyerPhone,
    directionsUrl,
    digitalContact,
    freeformText: freeform.join("\n"),
  };
}
function CopyPasteIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
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
  const [buyerReturnTrackingNumber, setBuyerReturnTrackingNumber] = useState("");
  const [buyerReturnTrackingCarrier, setBuyerReturnTrackingCarrier] = useState("");
  const [buyerReturnNote, setBuyerReturnNote] = useState("");
  const [msg, setMsg]             = useState("");
  const [copiedTrackingKey, setCopiedTrackingKey] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [resumingPayment, setResumingPayment] = useState(false);
  const [reviewImageUrls, setReviewImageUrls] = useState<string[]>([]);
  const [reviewUploading, setReviewUploading] = useState(false);
  const [claimingReviewReward, setClaimingReviewReward] = useState(false);
  const [showReviewPromptModal, setShowReviewPromptModal] = useState(false);
  const [itemCollapsed, setItemCollapsed] = useState(false);
  const [showSecondaryDetails, setShowSecondaryDetails] = useState(false);
  const [reviewUploadProgress, setReviewUploadProgress] = useState<{ done: number; total: number; current: string }>({
    done: 0,
    total: 0,
    current: "",
  });
  const autoJumpDoneRef = useRef(false);
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

  const copyTrackingToClipboard = async (text: string, key: string) => {
    const t = String(text ?? "").trim();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      setCopiedTrackingKey(key);
      window.setTimeout(() => {
        setCopiedTrackingKey((k) => (k === key ? null : k));
      }, 1800);
    } catch {
      setMsg("Could not copy to clipboard");
    }
  };

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
      if (d.success) {
        setOrder(d.data);
        if (newStatus === "completed" && user?.id === d.data?.buyer?.id && !d.data?.has_review) {
          setShowReviewPromptModal(true);
        }
        setMsg("Updated!");
        setTimeout(() => setMsg(""), 2500);
      }
      else setMsg(d.error ?? "Update failed");
    } catch { setMsg("Something went wrong"); }
    setUpdating(false);
  };

  const resumePendingPayment = async () => {
    if (!order || !isBuyer) return;
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    if (!isPiBrowser()) {
      setMsg("Open this order in Pi Browser to continue payment.");
      return;
    }

    setResumingPayment(true);
    setMsg("");
    try {
      await ensurePaymentReady();
      const amount = Number(order.amount_pi ?? order.listing?.price_pi ?? 0);
      if (!(amount > 0)) {
        setMsg("Invalid order amount.");
        setResumingPayment(false);
        return;
      }
      createPiPayment(
        {
          amount,
          memo: `Supapi Market: ${order.listing?.title ?? `Order ${order.id.slice(0, 8)}`}`,
          metadata: {
            platform: "market",
            order_id: order.id,
            listing_id: order.listing?.id ?? null,
          },
        },
        {
          onReadyForServerApproval: (paymentId: string) => {
            const base = getApiBase();
            fetch(`${base || ""}/api/payments/approve`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                paymentId,
                type: "listing",
                referenceId: order.id,
                amountPi: amount,
                memo: `Supapi Market: ${order.listing?.title ?? `Order ${order.id.slice(0, 8)}`}`,
                metadata: {
                  platform: "market",
                  order_id: order.id,
                  listing_id: order.listing?.id ?? null,
                },
              }),
            }).catch(() => {
              setMsg("Payment approval failed.");
              setResumingPayment(false);
            });
          },
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            try {
              const base = getApiBase();
              const r = await fetch(`${base || ""}/api/payments/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ paymentId, txid }),
              });
              const d = await r.json().catch(() => ({}));
              if (!r.ok || !d?.success) {
                setMsg(d?.error ?? "Payment completion failed.");
                setResumingPayment(false);
                return;
              }
              await fetchOrder();
              setMsg("Payment resumed successfully.");
            } catch {
              setMsg("Payment completion failed.");
            }
            setResumingPayment(false);
          },
          onCancel: () => {
            setMsg("Payment cancelled.");
            setResumingPayment(false);
          },
          onError: () => {
            setMsg("Payment error. Please try again.");
            setResumingPayment(false);
          },
        }
      );
    } catch {
      setMsg("Unable to start payment.");
      setResumingPayment(false);
    }
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
      order?.return_request && ["seller_rejected", "buyer_return_shipped"].includes(order.return_request.status)
        ? order.return_request.id
        : undefined;

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
        setMsg(accept ? "Return approved. Waiting for buyer return shipment." : "You declined the return request.");
        setSellerReturnNote("");
        await fetchOrder();
      } else setMsg(d.error ?? "Could not respond");
    } catch {
      setMsg("Something went wrong");
    }
    setReturnSubmitting(false);
  };

  const submitBuyerReturnShipment = async () => {
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    if (!buyerReturnTrackingNumber.trim()) {
      setMsg("Enter return tracking number first.");
      return;
    }
    setReturnSubmitting(true);
    setMsg("");
    try {
      const r = await fetch(`/api/supamarket/orders/${id}/return-request/ship`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tracking_number: buyerReturnTrackingNumber.trim(),
          tracking_carrier: buyerReturnTrackingCarrier.trim(),
          note: buyerReturnNote.trim(),
        }),
      });
      const d = await r.json();
      if (d.success) {
        setMsg("Return shipment submitted. Seller will confirm receipt.");
        setBuyerReturnTrackingNumber("");
        setBuyerReturnTrackingCarrier("");
        setBuyerReturnNote("");
        await fetchOrder();
      } else setMsg(d.error ?? "Could not submit return shipment");
    } catch {
      setMsg("Something went wrong");
    }
    setReturnSubmitting(false);
  };

  const confirmReturnReceived = async () => {
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    setReturnSubmitting(true);
    setMsg("");
    try {
      const r = await fetch(`/api/supamarket/orders/${id}/return-request/confirm-received`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note: sellerReturnNote.trim() }),
      });
      const d = await r.json();
      if (d.success) {
        setMsg("Return confirmed and refund completed.");
        setSellerReturnNote("");
        await fetchOrder();
      } else setMsg(d.error ?? "Could not confirm return receipt");
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

  const scrollToSection = (sectionId: string) => {
    if (typeof window === "undefined") return;
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const claimReviewReward = async () => {
    const token = localStorage.getItem("supapi_token");
    if (!token || !order) return;
    setClaimingReviewReward(true);
    setMsg("");
    try {
      const r = await fetch(`/api/supamarket/orders/${id}/review/reward`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.success) {
        if (d?.data?.already_claimed) {
          setMsg("Review reward already claimed.");
        } else if (d?.data?.sc_rewarded) {
          setMsg(`+${Number(d?.data?.sc_amount ?? 0)} SC credited from review reward.`);
        } else {
          setMsg("Review reward status updated.");
        }
        await fetchOrder();
      } else {
        setMsg(d.error ?? "Unable to claim review reward.");
      }
    } catch {
      setMsg("Unable to claim review reward.");
    }
    setClaimingReviewReward(false);
  };

  const getPrimaryActionSectionId = () => {
    if (!order || !user) return "";
    const buyerSide = user.id === order.buyer?.id;
    const sellerSide = user.id === order.seller?.id;
    if (buyerSide && order.status === "pending") return "pending-payment-section";
    if (sellerSide && (order.status === "paid" || order.status === "escrow")) return "seller-fulfillment-section";
    if (buyerSide && (order.status === "shipped" || order.status === "meetup_set")) return "confirm-receipt-section";
    if (buyerSide && order.status === "delivered") return "complete-order-section";
    if (buyerSide && order.status === "completed" && !order.has_review) return "review-section";
    if (sellerSide && order.status === "delivered" && ["pending_seller", "buyer_return_shipped"].includes(String(order.return_request?.status ?? ""))) {
      return "seller-return-section";
    }
    if (buyerSide && order.status === "delivered") return "return-refund-section";
    return "status-banner";
  };

  useEffect(() => {
    if (!order || !user) return;
    if (autoJumpDoneRef.current) return;
    autoJumpDoneRef.current = true;
    const target = getPrimaryActionSectionId();
    if (!target) return;
    window.setTimeout(() => {
      scrollToSection(target);
    }, 180);
  }, [order, user]);

  useEffect(() => {
    if (!order) return;
    setItemCollapsed(!order.listing);
  }, [order?.id, order?.listing]);

  useEffect(() => {
    autoJumpDoneRef.current = false;
  }, [id]);

  const renderTopBar = () => (
    <header className={styles.topBar}>
      <button
        className={styles.iconBtn}
        onClick={() => {
          if (order && user?.id === order.seller?.id) {
            router.push("/supamarket/selling");
            return;
          }
          if (order && user?.id === order.buyer?.id) {
            router.push("/supamarket/buying");
            return;
          }
          router.push("/supamarket/orders");
        }}
        aria-label={
          order && user?.id === order.seller?.id
            ? "Back to selling"
            : order && user?.id === order.buyer?.id
              ? "Back to buying orders"
              : "Back to orders"
        }
      >
        ←
      </button>
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
  const hasOpenDispute = !!(dispute && String(dispute.status) !== "resolved");
  const returnPhase = getReturnPhaseWithDispute(order, hasOpenDispute);
  const refundPiDisplay = Number(order.amount_pi ?? 0).toFixed(2);
  const returnEvidenceUrls = extractEvidenceUrls(order.return_request?.evidence);
  const normalizedStatus = order.status === "escrow" ? "paid" : order.status;
  const stepIdx  = STATUS_STEPS.indexOf(normalizedStatus);
  const isActive = !["completed","refunded","cancelled","disputed"].includes(normalizedStatus);
  const reviewRewardAmount = Number(order.review_reward_amount ?? 20);
  const reviewRewardLabel = `${reviewRewardAmount} SC`;
  const isDigitalOrder = order.buying_method === "digital";
  const parsedNotes = parseOrderNotes(order.notes ?? "");
  const sellerNeedsFulfillment = isSeller && (order.status === "paid" || order.status === "escrow");
  const buyerWaitingFulfillment = isBuyer && (order.status === "paid" || order.status === "escrow");
  const buyerNeedsReceiptConfirm = isBuyer && (order.status === "shipped" || order.status === "meetup_set");
  const sellerNeedsReturnAction =
    isSeller &&
    order.status === "delivered" &&
    ["pending_seller", "buyer_return_shipped"].includes(String(order.return_request?.status ?? ""));
  const buyerNeedsReturnAction = isBuyer && order.status === "delivered" && !hasOpenDispute;
  const buyerNeedsReview = isBuyer && order.status === "completed" && !order.has_review;
  const wizardMode =
    buyerNeedsReturnAction ||
    sellerNeedsReturnAction ||
    buyerNeedsReview ||
    sellerNeedsFulfillment ||
    buyerWaitingFulfillment ||
    buyerNeedsReceiptConfirm;
  const buyerReturnCta = (() => {
    if (!(isBuyer && order.status === "delivered" && !hasOpenDispute)) return null;
    if (returnPhase === "none") return { label: "Start return / refund request", target: "return-refund-section", disabled: false };
    if (returnPhase === "submitted") return { label: "View seller response status", target: "return-refund-section", disabled: false };
    if (returnPhase === "approved_waiting_buyer_ship") return { label: "Submit return tracking now", target: "return-refund-section", disabled: false };
    if (returnPhase === "buyer_shipped_waiting_seller_confirm") return { label: "Waiting seller confirmation", target: "return-refund-section", disabled: true };
    if (returnPhase === "rejected") return { label: "Ask for platform review", target: "return-refund-section", disabled: false };
    return null;
  })();
  const wizardStep = (() => {
    if (sellerNeedsFulfillment) {
      return {
        title: "Action required",
        sub: "Ship this order or set meetup details to continue.",
        target: "seller-fulfillment-section",
        cta: "Open fulfillment actions",
        disabled: false,
      };
    }
    if (buyerWaitingFulfillment) {
      return {
        title: "Current order step",
        sub: "Waiting for seller to ship or arrange meetup.",
        target: "status-banner",
        cta: "View status",
        disabled: false,
      };
    }
    if (buyerNeedsReceiptConfirm) {
      return {
        title: "Current order step",
        sub: "Confirm receipt once item arrives.",
        target: "confirm-receipt-section",
        cta: "Go to confirm receipt",
        disabled: false,
      };
    }
    if (buyerNeedsReview) {
      return {
        title: "Final step: Rate seller",
        sub: `Submit review now to claim your ${reviewRewardLabel}.`,
        target: "review-section",
        cta: "Rate now",
        disabled: false,
      };
    }
    if (sellerNeedsReturnAction) {
      return {
        title: "Action required",
        sub: "Review the return/refund request to proceed.",
        target: "seller-return-section",
        cta: "Continue",
        disabled: false,
      };
    }
    if (buyerNeedsReturnAction && buyerReturnCta) {
      return {
        title: "Current return/refund step",
        sub: "Continue the guided flow below.",
        target: buyerReturnCta.target,
        cta: buyerReturnCta.label,
        disabled: buyerReturnCta.disabled,
      };
    }
    return null;
  })();

  return (
    <div className={styles.page}>
      {renderTopBar()}
      {wizardStep ? (
        <div className={styles.wizardWrap}>
          <div className={styles.wizardCard}>
            <div className={styles.wizardTitle}>{wizardStep.title}</div>
            <div className={styles.wizardSub}>{wizardStep.sub}</div>
            <div className={styles.wizardActions}>
              <button
                type="button"
                className={styles.wizardPrimaryBtn}
                disabled={wizardStep.disabled}
                onClick={() => scrollToSection(wizardStep.target)}
              >
                {wizardStep.cta}
              </button>
              <button
                type="button"
                className={styles.wizardGhostBtn}
                onClick={() => setShowSecondaryDetails((v) => !v)}
              >
                {showSecondaryDetails ? "Hide extra details" : "View full order details"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Status Banner */}
      <div className={styles.statusBanner} data-status={order.status} id="status-banner">
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

      {/* Shopee-style return / refund progress (buyer, before platform case) */}
      {isBuyer && order.status === "delivered" && !hasOpenDispute && (
        <div className={styles.returnHubWrap}>
          <div className={styles.returnHub}>
            <div className={styles.returnHubTitle}>
              <span aria-hidden>↩️</span> Return &amp; Refund
            </div>
            <p className={styles.returnHubSub}>
              Request a refund from the seller first. If they agree, your π is released from escrow back to you. If they
              decline, you can ask for platform review below.
            </p>
            <div className={styles.returnRefundAmount}>
              <span>Refund amount (if approved)</span>
              <strong>{refundPiDisplay} π</strong>
            </div>
            <div className={styles.returnSteps}>
              <div
                className={`${styles.returnStepRow} ${returnPhase !== "none" ? styles.returnStepRowDone : ""} ${
                  returnPhase === "none" ? styles.returnStepRowActive : ""
                }`}
              >
                <div className={styles.returnStepIcon}>{returnPhase === "none" ? "1" : "✓"}</div>
                <div className={styles.returnStepBody}>
                  <div className={styles.returnStepLabel}>Request refund</div>
                  <p className={styles.returnStepHint}>Describe the issue and add photos. We&apos;ll notify the seller.</p>
                </div>
              </div>
              <div
                className={`${styles.returnStepRow} ${["approved_waiting_buyer_ship", "buyer_shipped_waiting_seller_confirm", "rejected", "escalated", "refunded_rr"].includes(returnPhase) ? styles.returnStepRowDone : ""} ${
                  returnPhase === "submitted" ? styles.returnStepRowActive : ""
                }`}
              >
                <div className={styles.returnStepIcon}>
                  {["approved_waiting_buyer_ship", "buyer_shipped_waiting_seller_confirm", "rejected", "escalated", "refunded_rr"].includes(returnPhase) ? "✓" : "2"}
                </div>
                <div className={styles.returnStepBody}>
                  <div className={styles.returnStepLabel}>Seller review</div>
                  <p className={styles.returnStepHint}>
                    The seller can agree to refund or decline. Please wait for their reply.
                  </p>
                  {returnPhase === "submitted" && order.return_request?.seller_response_deadline ? (
                    <div className={styles.returnCountdown}>
                      {formatSellerResponseCountdown(order.return_request.seller_response_deadline)}
                    </div>
                  ) : null}
                </div>
              </div>
              <div
                className={`${styles.returnStepRow} ${["buyer_shipped_waiting_seller_confirm", "refunded_rr"].includes(returnPhase) ? styles.returnStepRowDone : ""} ${
                  returnPhase === "approved_waiting_buyer_ship" ? styles.returnStepRowActive : ""
                }`}
              >
                <div className={styles.returnStepIcon}>
                  {["buyer_shipped_waiting_seller_confirm", "refunded_rr"].includes(returnPhase) ? "✓" : "3"}
                </div>
                <div className={styles.returnStepBody}>
                  <div className={styles.returnStepLabel}>Ship return item</div>
                  <p className={styles.returnStepHint}>
                    {returnPhase === "approved_waiting_buyer_ship"
                      ? "Seller approved. Send item back and upload return tracking."
                      : returnPhase === "buyer_shipped_waiting_seller_confirm"
                        ? "Return shipment submitted. Waiting for seller confirmation."
                        : "If seller approves, upload your return tracking in the section below."}
                  </p>
                  {returnPhase === "approved_waiting_buyer_ship" && order.return_request?.buyer_return_deadline ? (
                    <div className={styles.returnCountdown}>
                      {formatBuyerReturnCountdown(order.return_request.buyer_return_deadline)}
                    </div>
                  ) : null}
                </div>
              </div>
              <div
                className={`${styles.returnStepRow} ${["refunded_rr"].includes(returnPhase) ? styles.returnStepRowDone : ""} ${
                  returnPhase === "buyer_shipped_waiting_seller_confirm" || returnPhase === "rejected" ? styles.returnStepRowActive : ""
                }`}
              >
                <div className={styles.returnStepIcon}>{returnPhase === "refunded_rr" ? "✓" : "4"}</div>
                <div className={styles.returnStepBody}>
                  <div className={styles.returnStepLabel}>Refund or platform review</div>
                  <p className={styles.returnStepHint}>
                    {returnPhase === "rejected"
                      ? "Seller declined — use “Ask for platform review” in the section below."
                      : returnPhase === "buyer_shipped_waiting_seller_confirm"
                        ? "Seller should confirm receiving your return, then refund is released."
                        : returnPhase === "refunded_rr"
                          ? "Refund completed."
                          : "Final refund step after return shipment is verified."}
                  </p>
                </div>
              </div>
            </div>
            {buyerReturnCta ? (
              <button
                type="button"
                className={styles.returnHubCta}
                disabled={buyerReturnCta.disabled}
                onClick={() => scrollToSection(buyerReturnCta.target)}
              >
                {buyerReturnCta.label}
              </button>
            ) : null}
          </div>
        </div>
      )}

      {isBuyer && order.status === "disputed" && hasOpenDispute && (
        <div className={styles.returnHubWrap}>
          <div className={`${styles.returnHub} ${styles.returnHubSeller}`}>
            <div className={styles.returnHubTitle}>
              <span aria-hidden>⚖️</span> Return / refund case
            </div>
            <p className={styles.returnHubSub}>
              A case is open for this order. Our team will review and resolve it shortly — see the dispute section below for
              status and suggested resolution.
            </p>
          </div>
        </div>
      )}

      {isSeller &&
        order.status === "delivered" &&
        (order.return_request?.status === "pending_seller" || order.return_request?.status === "buyer_return_shipped") && (
        <div className={styles.returnHubWrap}>
          <div className={`${styles.returnHub} ${styles.returnHubSeller}`}>
            <div className={styles.returnHubTitle}>
              <span aria-hidden>🔔</span> Action required: return / refund
            </div>
            <p className={styles.returnHubSub}>
              {order.return_request?.status === "pending_seller"
                ? "The buyer requested a return. Approve or decline this request first."
                : "Buyer marked return as shipped. Confirm item receipt to release refund."}
            </p>
            {order.return_request?.status === "pending_seller" && order.return_request?.seller_response_deadline ? (
              <div className={styles.returnCountdown} style={{ marginTop: 0 }}>
                {formatSellerResponseCountdown(order.return_request.seller_response_deadline)}
              </div>
            ) : null}
            <button
              type="button"
              className={styles.returnHubCta}
              style={{ marginTop: 14 }}
              onClick={() => document.getElementById("seller-return-section")?.scrollIntoView({ behavior: "smooth" })}
            >
              Review request
            </button>
          </div>
        </div>
      )}

      <div className={styles.body}>
        {msg && <div className={`${styles.msg} ${msg === "Updated!" ? styles.msgSuccess : styles.msgError}`}>{msg}</div>}

        {isBuyer && order.status === "completed" && !order.has_review && (
          <div className={styles.reviewNudgeCard}>
            <div className={styles.reviewNudgeTitle}>🎁 {reviewRewardLabel} available</div>
            <div className={styles.reviewNudgeSub}>Submit a quick review now to claim your reward and help the community.</div>
            <button type="button" className={styles.reviewNudgeBtn} onClick={() => scrollToSection("review-section")}>
              Rate seller now
            </button>
          </div>
        )}
        {isBuyer && order.status === "completed" && order.has_review && !order.review_reward_claimed && (
          <div className={styles.reviewNudgeCard}>
            <div className={styles.reviewNudgeTitle}>🎁 Claim your {reviewRewardLabel}</div>
            <div className={styles.reviewNudgeSub}>Review is submitted. Tap below to claim your SC reward.</div>
            <button type="button" className={styles.reviewNudgeBtn} onClick={claimReviewReward} disabled={claimingReviewReward}>
              {claimingReviewReward ? "Claiming..." : "Claim reward"}
            </button>
          </div>
        )}
        {isBuyer && order.status === "completed" && order.has_review && order.review_reward_claimed && (
          <div className={styles.reviewClaimedBadge}>✅ Review reward claimed</div>
        )}

        {/* Listing */}
        {(!wizardMode || showSecondaryDetails) && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Item</div>
          {order.listing ? (
            <Link href={`/supamarket/${order.listing.id}`} className={styles.listingCard}>
              {order.listing.images?.[0] && <img src={order.listing.images[0]} alt="" className={styles.listingImg} />}
              <div className={styles.listingInfo}>
                <div className={styles.listingTitle}>{order.listing.title}</div>
                <div className={styles.listingPrice}>{Number(order.amount_pi).toFixed(2)} π</div>
                <div className={styles.listingCat}>
                  {formatListingCategoryPath(order.listing.category, order.listing.subcategory ?? "", order.listing.category_deep)} ·{" "}
                  {order.buying_method === "ship"
                    ? "📦 Shipping"
                    : order.buying_method === "digital"
                      ? "💻 Digital delivery"
                      : "📍 Meetup"}
                </div>
              </div>
            </Link>
          ) : (
            <div className={styles.removedWrap}>
              <div className={styles.removedNote}>Listing has been removed or archived.</div>
              <div className={styles.removedSub}>This does not block your order flow.</div>
              <button
                type="button"
                className={styles.removedToggleBtn}
                onClick={() => setItemCollapsed((v) => !v)}
              >
                {itemCollapsed ? "Show order item details" : "Hide order item details"}
              </button>
              {!itemCollapsed ? (
                <div className={styles.removedDetails}>
                  <div className={styles.removedDetailRow}>
                    <span>Order ID</span>
                    <strong>{order.id.slice(0, 8).toUpperCase()}</strong>
                  </div>
                  <div className={styles.removedDetailRow}>
                    <span>Amount</span>
                    <strong>{Number(order.amount_pi ?? 0).toFixed(2)} pi</strong>
                  </div>
                  <div className={styles.removedDetailRow}>
                    <span>Method</span>
                    <strong>
                      {order.buying_method === "ship"
                        ? "Shipping"
                        : order.buying_method === "meetup"
                          ? "Meetup"
                          : order.buying_method === "digital"
                            ? "Digital delivery"
                            : "Shipping or meetup"}
                    </strong>
                  </div>
                  <div className={styles.removedDetailRow}>
                    <span>Placed</span>
                    <strong>{fmt(order.created_at)}</strong>
                  </div>
                </div>
              ) : null}
              {itemCollapsed ? (
                <button
                  type="button"
                  className={styles.removedJumpBtn}
                  onClick={() => {
                    const target = getPrimaryActionSectionId();
                    scrollToSection(target);
                  }}
                >
                  Go to current step
                </button>
              ) : null}
            </div>
          )}
        </div>
        )}

        {/* Delivery / Meetup Info */}
        {(!wizardMode || showSecondaryDetails) && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            {order.buying_method === "ship" ? "Delivery Info" : order.buying_method === "digital" ? "Digital Delivery Info" : "Meetup Info"}
          </div>
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
                      <span className={styles.trackingWithCopy}>
                        <strong className={styles.tracking}>{order.tracking_number}</strong>
                        <button
                          type="button"
                          className={styles.copyTrackingBtn}
                          onClick={() => void copyTrackingToClipboard(order.tracking_number, "outbound")}
                          aria-label="Copy tracking number"
                          title="Copy tracking number"
                        >
                          <CopyPasteIcon />
                        </button>
                        {copiedTrackingKey === "outbound" ? (
                          <span className={styles.copiedHint} role="status">
                            Copied
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </div>
                )}
              </>
            ) : order.buying_method === "digital" ? (
              <>
                <div className={styles.infoRow}><span>Delivery</span><strong>Digital item</strong></div>
                <div className={styles.infoRow}><span>Status</span><strong>{order.status === "shipped" ? "Sent by seller" : "Pending seller delivery"}</strong></div>
                {parsedNotes.digitalContact ? (
                  <div className={styles.infoRow}>
                    <span>Delivery contact</span>
                    <strong>{parsedNotes.digitalContact}</strong>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className={styles.infoRow}><span>Location</span><strong>{order.meetup_location || "TBD"}</strong></div>
                {order.meetup_time && <div className={styles.infoRow}><span>Time</span><strong>{fmt(order.meetup_time)}</strong></div>}
                <div className={styles.infoRow}>
                  <span>Phone</span>
                  <strong>{parsedNotes.meetupBuyerPhone || "—"}</strong>
                </div>
                {parsedNotes.directionsUrl ? (
                  <div className={styles.infoRow}>
                    <span>Directions</span>
                    <a
                      href={parsedNotes.directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.infoRowLink}
                    >
                      Open map link
                    </a>
                  </div>
                ) : null}
              </>
            )}
            {parsedNotes.freeformText ? (
              <div className={styles.infoRow}><span>Notes</span><strong>{parsedNotes.freeformText}</strong></div>
            ) : null}
          </div>
        </div>
        )}

        {/* Buyer resume pending payment */}
        {isBuyer && order.status === "pending" && (
          <div className={styles.section} id="pending-payment-section">
            <div className={styles.sectionTitle}>💳 Pending payment</div>
            <div className={styles.confirmNote}>
              This order is awaiting payment confirmation. Continue payment to lock funds in escrow and proceed with the order.
            </div>
            <button className={styles.actionBtn} disabled={resumingPayment || updating} onClick={resumePendingPayment}>
              {resumingPayment ? "Opening Pi Payment..." : "Resume Payment"}
            </button>
          </div>
        )}

        {/* Seller actions */}
        {isSeller && (order.status === "paid" || order.status === "escrow") && (
          <div className={styles.section} id="seller-fulfillment-section">
            <div className={styles.sectionTitle}>
              {order.buying_method === "digital"
                ? "💻 Deliver digital item"
                : order.buying_method === "ship"
                ? "📦 Ship This Order"
                : order.buying_method === "both"
                  ? "📦 Delivery or meetup"
                  : "📍 Arrange Meetup"}
            </div>
            {order.buying_method === "digital" ? (
              <>
                <div className={styles.confirmNote}>
                  Share access/download details with buyer first, then mark this order as digitally delivered.
                </div>
                <button className={styles.actionBtn} disabled={updating} onClick={() => updateStatus("shipped")}>
                  {updating ? "Updating..." : "Mark digital item delivered 💻"}
                </button>
              </>
            ) : null}
            {(order.buying_method === "ship" || order.buying_method === "both") ? (
              <>
                <div className={styles.trackingInputWrap}>
                  <input
                    className={styles.input}
                    placeholder="Courier company (e.g. DHL, FedEx, J&T Express, Ninja Van)"
                    value={courierInput}
                    onChange={e => setCourierInput(e.target.value)}
                    required
                    aria-required
                  />
                  <input
                    className={styles.input}
                    placeholder="Tracking number"
                    value={trackingInput}
                    onChange={e => setTrackingInput(e.target.value)}
                    required
                    aria-required
                  />
                  <div className={styles.trackingHint}>
                    Both courier name and tracking number are required — the buyer will use them on the carrier&apos;s site.
                  </div>
                </div>
                <button className={styles.actionBtn} disabled={updating}
                  onClick={() => {
                    const tn = trackingInput.trim();
                    const tc = courierInput.trim();
                    if (!tn || !tc) {
                      setMsg("Please enter courier company and tracking number.");
                      return;
                    }
                    updateStatus("shipped", { tracking_number: tn, tracking_carrier: tc });
                  }}>
                  {updating ? "Updating..." : "Mark as Shipped 📦"}
                </button>
              </>
            ) : null}
            {order.buying_method === "meetup" ? (
              <>
                <input className={styles.input} placeholder="Confirm meetup location"
                  value={meetupInput} onChange={e => setMeetupInput(e.target.value)} />
                <button className={styles.actionBtn} disabled={updating}
                  onClick={() => {
                    const loc = meetupInput.trim();
                    if (!loc) {
                      setMsg("Please enter a meetup location.");
                      return;
                    }
                    updateStatus("meetup_set", { meetup_location: loc });
                  }}>
                  {updating ? "Updating..." : "Confirm Meetup 📍"}
                </button>
              </>
            ) : null}
            {order.buying_method === "both" ? (
              <>
                <div className={styles.sectionTitle} style={{ marginTop: 16 }}>📍 Or arrange meetup</div>
                <input className={styles.input} placeholder="Confirm meetup location"
                  value={meetupInput} onChange={e => setMeetupInput(e.target.value)} />
                <button className={styles.actionBtn} disabled={updating}
                  onClick={() => {
                    const loc = meetupInput.trim();
                    if (!loc) {
                      setMsg("Please enter a meetup location.");
                      return;
                    }
                    updateStatus("meetup_set", { meetup_location: loc });
                  }}>
                  {updating ? "Updating..." : "Confirm Meetup 📍"}
                </button>
              </>
            ) : null}
          </div>
        )}

        {/* Buyer confirm delivery */}
        {isBuyer && (order.status === "shipped" || order.status === "meetup_set") && (
          <div className={styles.section} id="confirm-receipt-section">
            <div className={styles.sectionTitle}>{isDigitalOrder ? "✅ Confirm Digital Delivery" : "✅ Confirm Receipt"}</div>
            <div className={styles.confirmNote}>
              {isDigitalOrder
                ? "Once confirmed, you can complete the order and then rate seller to claim your reward."
                : "Once confirmed, you can complete the order to release payment to the seller. If you take no action, receipt may be auto-confirmed after several days (see Return & Refund policy)."}
            </div>
            <button className={styles.confirmBtn} disabled={updating} onClick={() => updateStatus("delivered")}>
              {updating ? "Updating..." : isDigitalOrder ? "I've received digital delivery ✅" : "I've Received This Item ✅"}
            </button>
          </div>
        )}

        {/* Buyer complete */}
        {isBuyer && order.status === "delivered" && (
          <div className={styles.section} id="complete-order-section">
            <div className={styles.sectionTitle}>{isDigitalOrder ? "🎉 Complete Digital Order" : "🎉 Complete Order"}</div>
            <div className={styles.confirmNote}>
              {isDigitalOrder
                ? "Happy with your digital purchase? Mark as complete, then rate seller to claim your reward."
                : "Happy with your purchase? Mark as complete to finalise payment to the seller. If you do nothing, the order may auto-complete after a short period unless a return request is open."}
              {["pending_seller", "seller_approved_return", "buyer_return_shipped"].includes(
                String(order.return_request?.status ?? "")
              ) ? (
                <span className={styles.returnWarning}>
                  {" "}
                  You have an active return flow — complete the order only after return/refund is resolved.
                </span>
              ) : null}
            </div>
            <button
              className={styles.confirmBtn}
              disabled={
                updating ||
                ["pending_seller", "seller_approved_return", "buyer_return_shipped"].includes(
                  String(order.return_request?.status ?? "")
                )
              }
              onClick={() => updateStatus("completed")}
            >
              {updating ? "Updating..." : "Complete Order 🎉"}
            </button>
          </div>
        )}

        {/* Buyer rate seller (completed, not yet reviewed) */}
        {isBuyer && order.status === "completed" && !order.has_review && (
          <div className={styles.section} id="review-section">
            <div className={styles.sectionTitle}>⭐ Rate Seller</div>
            <div className={styles.reviewRewardBanner}>🎁 Earn {reviewRewardLabel} when you submit this review.</div>
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
                    const scAmount = Number(d?.data?.sc_amount ?? 0);
                    const scRewarded = Boolean(d?.data?.sc_rewarded) && scAmount > 0;
                    setMsg(scRewarded ? `Thanks for your review! +${scAmount} SC credited.` : "Thanks for your review!");
                    setReviewImageUrls([]);
                    await fetchOrder();
                  } else setMsg(d.error ?? "Failed to submit review");
                } catch {
                  setMsg("Something went wrong");
                }
                setReviewSubmitting(false);
              }}
            >
              {reviewSubmitting ? "Submitting..." : `Submit Review + Claim ${reviewRewardLabel}`}
            </button>
          </div>
        )}

        {/* Counterpart info */}
        {(!wizardMode || showSecondaryDetails) && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{isBuyer ? "Seller" : "Buyer"}</div>
          {(() => {
            const other = isBuyer ? order.seller : order.buyer;
            const uname = String(other?.username ?? "").trim();
            const displayName = (other?.display_name ?? uname) || "Unknown user";
            const profileHref = uname ? `/supaspace/${uname}` : "";
            const personBody = (
              <>
                <div className={styles.personAvatar}>
                  {other?.avatar_url
                    ? <img src={other.avatar_url} alt="" className={styles.personAvatarImg} />
                    : <span>{getInitial(uname || "?")}</span>
                  }
                </div>
                <div>
                  <div className={styles.personName}>{displayName}</div>
                  <div className={styles.personSub}>
                    {uname ? `@${uname} · View Profile →` : "Profile unavailable"}
                  </div>
                </div>
              </>
            );
            return profileHref ? (
              <Link href={profileHref} className={styles.personCard}>
                {personBody}
              </Link>
            ) : (
              <div className={`${styles.personCard} ${styles.personCardMuted}`}>
                {personBody}
              </div>
            );
          })()}
        </div>
        )}

        {/* Seller: respond to return / refund request */}
        {isSeller &&
          order.status === "delivered" &&
          (order.return_request?.status === "pending_seller" || order.return_request?.status === "buyer_return_shipped") && (
          <div className={styles.section} id="seller-return-section">
            <div className={styles.sectionTitle}>↩️ Return / refund request</div>
            {order.return_request?.status === "pending_seller" ? (
              <div className={styles.disputeNote}>
                The buyer asked for a return. Respond within{" "}
                <strong>{new Date(order.return_request.seller_response_deadline).toLocaleString()}</strong>.
                Approve to ask buyer for return shipment, or decline to allow platform review.
              </div>
            ) : (
              <div className={styles.disputeNote}>
                Buyer submitted return shipment details. Confirm once you have received the returned item.
              </div>
            )}
            <div className={styles.infoBox} style={{ marginBottom: 10 }}>
              <div className={styles.infoRow}>
                <span>Category</span>
                <strong>{returnCategoryLabel(order.return_request.category)}</strong>
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
            {order.return_request?.status === "buyer_return_shipped" && (
              <div className={styles.infoBox} style={{ marginBottom: 10 }}>
                <div className={styles.infoRow}>
                  <span>Return courier</span>
                  <strong>{order.return_request.buyer_return_tracking_carrier || "Not provided"}</strong>
                </div>
                <div className={styles.infoRow}>
                  <span>Return tracking</span>
                  <span className={styles.trackingWithCopy}>
                    <strong className={styles.tracking}>
                      {order.return_request.buyer_return_tracking_number || "—"}
                    </strong>
                    {order.return_request.buyer_return_tracking_number ? (
                      <>
                        <button
                          type="button"
                          className={styles.copyTrackingBtn}
                          onClick={() => {
                            const n = order.return_request?.buyer_return_tracking_number;
                            if (n) void copyTrackingToClipboard(n, "return-seller");
                          }}
                          aria-label="Copy return tracking number"
                          title="Copy return tracking number"
                        >
                          <CopyPasteIcon />
                        </button>
                        {copiedTrackingKey === "return-seller" ? (
                          <span className={styles.copiedHint} role="status">
                            Copied
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </span>
                </div>
                {order.return_request.buyer_return_note ? (
                  <div className={styles.infoRow}>
                    <span>Buyer note</span>
                    <strong>{order.return_request.buyer_return_note}</strong>
                  </div>
                ) : null}
              </div>
            )}
            <textarea
              className={styles.input}
              rows={2}
              placeholder={
                order.return_request?.status === "pending_seller"
                  ? "Note to buyer (required if you decline)"
                  : "Optional note while confirming receipt"
              }
              value={sellerReturnNote}
              onChange={(e) => setSellerReturnNote(e.target.value)}
              disabled={returnSubmitting}
            />
            {order.return_request?.status === "pending_seller" ? (
              <div className={styles.btnRow}>
                <button
                  type="button"
                  className={styles.confirmBtn}
                  disabled={returnSubmitting}
                  onClick={() => void respondReturn(true)}
                >
                  {returnSubmitting ? "…" : "Approve return request"}
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
            ) : (
              <button
                type="button"
                className={styles.confirmBtn}
                disabled={returnSubmitting}
                onClick={() => void confirmReturnReceived()}
              >
                {returnSubmitting ? "Confirming..." : "Confirm item received & refund"}
              </button>
            )}
          </div>
        )}

        {/* Buyer: return / refund first (replaces direct dispute while delivered) */}
        {isBuyer && order.status === "delivered" && !dispute && (
          <div className={styles.section} id="return-refund-section">
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
            ) : order.return_request?.status === "seller_approved_return" ? (
              <>
                <div className={styles.disputeNote}>
                  Seller approved your return request. Ship item back and submit return tracking below
                  {order.return_request.buyer_return_deadline
                    ? ` before ${new Date(order.return_request.buyer_return_deadline).toLocaleString()}`
                    : ""}.
                </div>
                <div className={styles.trackingInputWrap}>
                  <input
                    className={styles.input}
                    placeholder="Return courier (e.g. J&T, PosLaju, DHL)"
                    value={buyerReturnTrackingCarrier}
                    onChange={(e) => setBuyerReturnTrackingCarrier(e.target.value)}
                  />
                  <input
                    className={styles.input}
                    placeholder="Return tracking number"
                    value={buyerReturnTrackingNumber}
                    onChange={(e) => setBuyerReturnTrackingNumber(e.target.value)}
                  />
                </div>
                <textarea
                  className={styles.input}
                  rows={2}
                  placeholder="Optional note to seller"
                  value={buyerReturnNote}
                  onChange={(e) => setBuyerReturnNote(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.confirmBtn}
                  disabled={returnSubmitting || !buyerReturnTrackingNumber.trim()}
                  onClick={() => void submitBuyerReturnShipment()}
                >
                  {returnSubmitting ? "Submitting..." : "Submit return shipment"}
                </button>
              </>
            ) : order.return_request?.status === "buyer_return_shipped" ? (
              <>
                <div className={styles.disputeNote}>
                  Return shipment submitted. Seller will confirm receipt, then refund is released from escrow.
                </div>
                <div className={styles.infoBox} style={{ marginBottom: 10 }}>
                  <div className={styles.infoRow}>
                    <span>Return courier</span>
                    <strong>{order.return_request.buyer_return_tracking_carrier || "Not provided"}</strong>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Return tracking</span>
                    <span className={styles.trackingWithCopy}>
                      <strong className={styles.tracking}>
                        {order.return_request.buyer_return_tracking_number || "—"}
                      </strong>
                      {order.return_request.buyer_return_tracking_number ? (
                        <>
                          <button
                            type="button"
                            className={styles.copyTrackingBtn}
                            onClick={() => {
                              const n = order.return_request?.buyer_return_tracking_number;
                              if (n) void copyTrackingToClipboard(n, "return-buyer");
                            }}
                            aria-label="Copy return tracking number"
                            title="Copy return tracking number"
                          >
                            <CopyPasteIcon />
                          </button>
                          {copiedTrackingKey === "return-buyer" ? (
                            <span className={styles.copiedHint} role="status">
                              Copied
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </span>
                  </div>
                </div>
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
                        <label className={styles.formLabel}>Reason for refund</label>
                        <select
                          className={styles.input}
                          value={disputeCategory}
                          onChange={(e) => setDisputeCategory(e.target.value)}
                        >
                          <option value="delivery_issue">Did not receive / delivery problem</option>
                          <option value="damaged_item">Item arrived damaged</option>
                          <option value="wrong_item">Wrong item sent</option>
                          <option value="item_not_as_described">Not as described</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className={styles.formField}>
                        <label className={styles.formLabel}>Preferred resolution</label>
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
                      <label className={styles.formLabel}>Incident date (optional)</label>
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
                      <label className={styles.formLabel}>Photos (up to 6 — strongly recommended)</label>
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
                  Start here: send a return or refund request to the seller first. If they decline, you can ask for
                  platform review in this same section. Clear photos speed up decisions.
                </div>
                {!showReturnForm ? (
                  <button type="button" className={styles.disputeOpenBtn} onClick={() => setShowReturnForm(true)}>
                    Fill in return / refund form
                  </button>
                ) : (
                  <>
                    <div className={styles.disputeMetaGrid}>
                      <div className={styles.formField}>
                        <label className={styles.formLabel}>Reason for refund</label>
                        <select
                          className={styles.input}
                          value={disputeCategory}
                          onChange={(e) => setDisputeCategory(e.target.value)}
                        >
                          <option value="delivery_issue">Did not receive / delivery problem</option>
                          <option value="damaged_item">Item arrived damaged</option>
                          <option value="wrong_item">Wrong item sent</option>
                          <option value="item_not_as_described">Not as described</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Incident date (optional)</label>
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
                      placeholder="Describe the problem clearly (product condition, what you expected, etc.)..."
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                    />
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Photos (up to 6 — strongly recommended)</label>
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
              {(disputeResult?.confidence ?? dispute?.ai_confidence) != null && (
                <div className={styles.disputeConfidence}>
                  Estimated clarity: {Math.round((disputeResult?.confidence ?? dispute?.ai_confidence) * 100)}%
                </div>
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
        {(!wizardMode || showSecondaryDetails) && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Order Info</div>
          <div className={styles.infoBox}>
            <div className={styles.infoRow}><span>Order ID</span><strong className={styles.orderId}>{order.id.slice(0,8)}...</strong></div>
            <div className={styles.infoRow}><span>Placed</span><strong>{fmt(order.created_at)}</strong></div>
            {order.pi_payment_id && <div className={styles.infoRow}><span>Payment ID</span><strong className={styles.orderId}>{order.pi_payment_id.slice(0,12)}...</strong></div>}
            <div className={styles.infoRow}><span>Escrow</span><strong>🔒 Pi Network Escrow</strong></div>
          </div>
        </div>
        )}
      </div>

      {showReviewPromptModal && isBuyer && order.status === "completed" && !order.has_review ? (
        <div className={styles.modalOverlay} onClick={() => setShowReviewPromptModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>🎉 Order completed</div>
            <div className={styles.modalSub}>Rate the seller now and claim your {reviewRewardLabel}.</div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.modalGhostBtn} onClick={() => setShowReviewPromptModal(false)}>
                Later
              </button>
              <button
                type="button"
                className={styles.modalPrimaryBtn}
                onClick={() => {
                  setShowReviewPromptModal(false);
                  scrollToSection("review-section");
                }}
              >
                Rate now
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}