"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "../orders/page.module.css";

type ReturnBadge = { status?: string | null } | null | undefined;

type Party = {
  username?: string | null;
};

type Listing = {
  title?: string | null;
  images?: string[] | null;
} | null;

type BuyingOrder = {
  id: string;
  status: string;
  amount_pi: number | string;
  created_at: string;
  has_review?: boolean;
  listing?: Listing;
  seller?: Party;
  return_badge?: ReturnBadge;
};

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d === 0 ? "Today" : d === 1 ? "Yesterday" : `${d}d ago`;
}

const STATUS_META: Record<string, { label: string }> = {
  pending: { label: "Pending" },
  escrow: { label: "Paid" },
  paid: { label: "Paid" },
  shipped: { label: "Shipped" },
  meetup_set: { label: "Meetup Set" },
  delivered: { label: "Delivered" },
  completed: { label: "Completed" },
  disputed: { label: "Disputed" },
  refunded: { label: "Refunded" },
  cancelled: { label: "Cancelled" },
};

const STATUS_CLASS: Record<string, string> = {
  pending: "statusPending",
  escrow: "statusPaid",
  paid: "statusPaid",
  shipped: "statusShipped",
  meetup_set: "statusMeetup",
  delivered: "statusDelivered",
  completed: "statusCompleted",
  disputed: "statusDisputed",
  refunded: "statusRefunded",
  cancelled: "statusCancelled",
};

const PAGE_SIZE = 10;

function returnBadgeCopy(badge: ReturnBadge): string | null {
  const s = String(badge?.status ?? "");
  if (!s) return null;
  if (s === "pending_seller") return "Return pending";
  if (s === "seller_approved_return") return "Ship return item";
  if (s === "buyer_return_shipped") return "Return in transit";
  if (s === "seller_rejected") return "Next: platform review";
  if (s === "escalated") return "Case in review";
  return null;
}

export default function BuyingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<BuyingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersPage, setOrdersPage] = useState(1);

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "");

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await fetch("/api/supamarket/orders?role=buyer", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (d?.success) setOrders((d.data ?? []) as BuyingOrder[]);
    } catch {
      // no-op: empty state shown
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      router.push("/dashboard");
      return;
    }
    fetchOrders();
  }, [user, fetchOrders, router]);

  useEffect(() => {
    setOrdersPage(1);
  }, [orders.length]);

  if (!user) return null;

  const sortedOrders = [...orders].sort((a, b) => {
    const aPendingReview = String(a.status ?? "") === "completed" && !a.has_review;
    const bPendingReview = String(b.status ?? "") === "completed" && !b.has_review;
    if (aPendingReview !== bPendingReview) return aPendingReview ? -1 : 1;
    return new Date(String(b.created_at ?? 0)).getTime() - new Date(String(a.created_at ?? 0)).getTime();
  });

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / PAGE_SIZE));
  const pageSafe = Math.min(ordersPage, totalPages);
  const pageOrders = sortedOrders.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  const pendingReviewOrders = sortedOrders.filter((o) => String(o.status ?? "") === "completed" && !o.has_review);
  const pendingReviewCount = pendingReviewOrders.length;

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Buying", url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // user cancelled share flow
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <button className={styles.iconBtn} onClick={() => router.push("/dashboard")} aria-label="Back to dashboard">
          ←
        </button>
        <h1 className={styles.title}>Buying</h1>
        <button className={styles.iconBtn} onClick={handleShare} aria-label="Share">
          ⤴
        </button>
      </header>

      <div className={styles.body}>
        {!loading && pendingReviewCount > 0 ? (
          <div className={styles.pendingReviewCard}>
            <div className={styles.pendingReviewTitle}>🎁 Earn SC reward now · {pendingReviewCount} pending</div>
            <div className={styles.pendingReviewSub}>Rate seller now to claim your SC reward and help other buyers.</div>
            <Link href={`/supamarket/orders/${pendingReviewOrders[0].id}#review-section`} className={styles.pendingReviewBtn}>
              Rate now + claim SC
            </Link>
          </div>
        ) : null}

        {loading ? (
          [...Array(4)].map((_, i) => <div key={i} className={styles.skeletonRow} />)
        ) : orders.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🛒</div>
            <div className={styles.emptyTitle}>No purchases yet</div>
            <div className={styles.emptyDesc}>Browse the marketplace and make your first purchase.</div>
            <Link href="/supamarket" className={styles.emptyBtn}>
              Browse SupaMarket
            </Link>
          </div>
        ) : (
          <>
            {pageOrders.map((order) => {
              const meta = STATUS_META[order.status] ?? STATUS_META.pending;
              const listing = order.listing;
              const statusClass = STATUS_CLASS[order.status] ?? STATUS_CLASS.pending;
              const returnNote = returnBadgeCopy(order.return_badge);
              const showReviewReward = String(order.status ?? "") === "completed" && !order.has_review;

              const orderHref = showReviewReward
                ? `/supamarket/orders/${order.id}#review-section`
                : `/supamarket/orders/${order.id}`;

              return (
                <Link
                  key={order.id}
                  href={orderHref}
                  className={`${styles.orderRow} ${showReviewReward ? styles.orderRowReward : ""}`}
                >
                  <div className={styles.orderImg}>
                    {listing?.images?.[0] ? <img src={listing.images[0]} alt="" className={styles.orderImgEl} /> : <span>🛍️</span>}
                  </div>
                  <div className={styles.orderInfo}>
                    <div className={styles.orderTitle}>{listing?.title ?? "Item"}</div>
                    <div className={styles.orderMeta}>
                      <span className={styles.orderPrice}>{parseFloat(String(order.amount_pi ?? 0)).toFixed(2)} π</span>
                      <span className={`${styles.orderStatus} ${styles[statusClass]}`} aria-label={`Status ${meta.label}`}>
                        {meta.label}
                      </span>
                      {returnNote ? (
                        <span className={styles.returnBadge} aria-label={returnNote}>
                          {returnNote}
                        </span>
                      ) : null}
                      {showReviewReward ? (
                        <span className={styles.reviewRewardBadge} aria-label="SC reward available">
                          SC reward available
                        </span>
                      ) : null}
                    </div>
                    <div className={styles.orderSub}>
                      Seller: @{order.seller?.username ?? "unknown"} · {timeAgo(order.created_at)}
                      {showReviewReward ? " · Tap to rate seller" : ""}
                    </div>
                  </div>
                  <span className={styles.orderArrow}>→</span>
                </Link>
              );
            })}
            {totalPages > 1 ? (
              <div className={styles.pager}>
                <button
                  type="button"
                  className={styles.pagerBtn}
                  disabled={pageSafe === 1}
                  onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                >
                  ← Prev
                </button>
                <span className={styles.pagerInfo}>
                  Page {pageSafe} of {totalPages}
                </span>
                <button
                  type="button"
                  className={styles.pagerBtn}
                  disabled={pageSafe === totalPages}
                  onClick={() => setOrdersPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next →
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
