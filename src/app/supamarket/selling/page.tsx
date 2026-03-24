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

type SellingOrder = {
  id: string;
  status: string;
  amount_pi: number | string;
  created_at: string;
  listing?: Listing;
  buyer?: Party;
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
  if (s === "pending_seller") return "Review return";
  if (s === "seller_approved_return") return "Wait buyer return";
  if (s === "buyer_return_shipped") return "Confirm return received";
  if (s === "seller_rejected") return "Return declined";
  if (s === "escalated") return "Case in review";
  return null;
}

export default function SellingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<SellingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersPage, setOrdersPage] = useState(1);

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "");

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await fetch("/api/supamarket/orders?role=seller", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (d?.success) setOrders((d.data ?? []) as SellingOrder[]);
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

  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const pageSafe = Math.min(ordersPage, totalPages);
  const pageOrders = orders.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Selling", url });
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
        <h1 className={styles.title}>Selling</h1>
        <button className={styles.iconBtn} onClick={handleShare} aria-label="Share">
          ⤴
        </button>
      </header>

      <div className={styles.body}>
        {loading ? (
          [...Array(4)].map((_, i) => <div key={i} className={styles.skeletonRow} />)
        ) : orders.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🏷️</div>
            <div className={styles.emptyTitle}>No selling orders yet</div>
            <div className={styles.emptyDesc}>Create a listing and start receiving buyer orders.</div>
            <Link href="/supamarket/create" className={styles.emptyBtn}>
              Create Listing
            </Link>
          </div>
        ) : (
          <>
            {pageOrders.map((order) => {
              const meta = STATUS_META[order.status] ?? STATUS_META.pending;
              const listing = order.listing;
              const statusClass = STATUS_CLASS[order.status] ?? STATUS_CLASS.pending;
              const returnNote = returnBadgeCopy(order.return_badge);

              return (
                <Link key={order.id} href={`/supamarket/orders/${order.id}`} className={styles.orderRow}>
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
                    </div>
                    <div className={styles.orderSub}>Buyer: @{order.buyer?.username ?? "unknown"} · {timeAgo(order.created_at)}</div>
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
