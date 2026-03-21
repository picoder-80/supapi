"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./page.module.css";

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d === 0 ? "Today" : d === 1 ? "Yesterday" : `${d}d ago`;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: "Pending",    color: "#744210", bg: "#FFFAF0" },
  escrow:     { label: "Paid",       color: "#276749", bg: "#F0FFF4" },
  paid:       { label: "Paid",       color: "#276749", bg: "#F0FFF4" },
  shipped:    { label: "Shipped",    color: "#2B6CB0", bg: "#EBF8FF" },
  meetup_set: { label: "Meetup Set", color: "#553C9A", bg: "#FAF5FF" },
  delivered:  { label: "Delivered",  color: "#276749", bg: "#F0FFF4" },
  completed:  { label: "Completed",  color: "#2D3748", bg: "#EDF2F7" },
  disputed:   { label: "Disputed",   color: "#9B2335", bg: "#FFF5F5" },
  refunded:   { label: "Refunded",   color: "#2B6CB0", bg: "#EBF8FF" },
  cancelled:  { label: "Cancelled",  color: "#A0AEC0", bg: "#F7FAFC" },
};

const PAGE_SIZE = 10;

function returnBadgeCopy(
  badge: { status?: string } | null | undefined,
  tab: "buying" | "selling"
): string | null {
  if (!badge?.status) return null;
  const s = badge.status;
  if (s === "pending_seller") return tab === "selling" ? "Review return" : "Return pending";
  if (s === "seller_approved_return") return tab === "selling" ? "Wait buyer return" : "Ship return item";
  if (s === "buyer_return_shipped") return tab === "selling" ? "Confirm return received" : "Return in transit";
  if (s === "seller_rejected") return tab === "selling" ? "Return declined" : "Next: platform review";
  if (s === "escalated") return "Case in review";
  return null;
}

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

export default function OrdersPage() {
  const { user }  = useAuth();
  const router    = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab]           = useState<"buying"|"selling">("buying");
  const [orders, setOrders]     = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [ordersPage, setOrdersPage] = useState(1);

  const token = () => typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "";

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/supamarket/orders?role=${tab === "buying" ? "buyer" : "seller"}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const d = await r.json();
      if (d.success) setOrders(d.data ?? []);
    } catch {}
    setLoading(false);
  }, [user, tab]);

  useEffect(() => {
    if (!user) { router.push("/dashboard"); return; }
    fetchOrders();
  }, [user, fetchOrders, router]);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "selling") setTab("selling");
    else if (t === "buying") setTab("buying");
  }, [searchParams]);

  useEffect(() => { setOrdersPage(1); }, [tab]);

  if (!user) return null;

  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const pageSafe = Math.min(ordersPage, totalPages);
  const pageOrders = orders.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My Orders", url });
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
        <button className={styles.iconBtn} onClick={() => router.back()} aria-label="Go back">←</button>
        <h1 className={styles.title}>My Orders</h1>
        <button className={styles.iconBtn} onClick={handleShare} aria-label="Share">⤴</button>
      </header>

      <div className={styles.tabsCard}>
        <button className={`${styles.tab} ${tab === "buying" ? styles.tabActive : ""}`}
          onClick={() => setTab("buying")}>🛒 Buying</button>
        <button className={`${styles.tab} ${tab === "selling" ? styles.tabActive : ""}`}
          onClick={() => setTab("selling")}>🏷️ Selling</button>
      </div>

      <div className={styles.body}>
        {loading ? (
          [...Array(4)].map((_, i) => <div key={i} className={styles.skeletonRow} />)
        ) : orders.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>{tab === "buying" ? "🛒" : "🏷️"}</div>
            <div className={styles.emptyTitle}>No orders yet</div>
            <div className={styles.emptyDesc}>
              {tab === "buying" ? "Browse the marketplace and make your first purchase!" : "Create a listing to start selling!"}
            </div>
            <Link href={tab === "buying" ? "/supamarket" : "/supamarket/create"} className={styles.emptyBtn}>
              {tab === "buying" ? "Browse SupaMarket" : "Create Listing"}
            </Link>
          </div>
        ) : (
          <>
            {pageOrders.map(order => {
              const meta    = STATUS_META[order.status] ?? STATUS_META.pending;
              const listing = order.listing;
              const other   = tab === "buying" ? order.seller : order.buyer;
              const statusClass = STATUS_CLASS[order.status] ?? STATUS_CLASS.pending;
              const returnNote = returnBadgeCopy(order.return_badge, tab);
              return (
                <Link key={order.id} href={`/supamarket/orders/${order.id}`} className={styles.orderRow}>
                  <div className={styles.orderImg}>
                    {listing?.images?.[0]
                      ? <img src={listing.images[0]} alt="" className={styles.orderImgEl} />
                      : <span>🛍️</span>
                    }
                  </div>
                  <div className={styles.orderInfo}>
                    <div className={styles.orderTitle}>{listing?.title ?? "Item"}</div>
                    <div className={styles.orderMeta}>
                      <span className={styles.orderPrice}>{parseFloat(order.amount_pi ?? 0).toFixed(2)} π</span>
                      <span className={`${styles.orderStatus} ${styles[statusClass]}`} aria-label={`Status ${meta.label}`}>
                        {meta.label}
                      </span>
                      {returnNote ? (
                        <span className={styles.returnBadge} aria-label={returnNote}>
                          {returnNote}
                        </span>
                      ) : null}
                    </div>
                    <div className={styles.orderSub}>
                      {tab === "buying" ? "Seller" : "Buyer"}: @{other?.username} · {timeAgo(order.created_at)}
                    </div>
                  </div>
                  <span className={styles.orderArrow}>→</span>
                </Link>
              );
            })}
            {totalPages > 1 && (
              <div className={styles.pager}>
                <button type="button" className={styles.pagerBtn} disabled={pageSafe === 1} onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}>← Prev</button>
                <span className={styles.pagerInfo}>Page {pageSafe} of {totalPages}</span>
                <button type="button" className={styles.pagerBtn} disabled={pageSafe === totalPages} onClick={() => setOrdersPage((p) => Math.min(totalPages, p + 1))}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
