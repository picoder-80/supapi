"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d === 0 ? "Today" : d === 1 ? "Yesterday" : `${d}d ago`;
}

const STATUS_META: Record<string, string> = {
  pending: "Pending",
  escrow: "Paid",
  paid: "Paid",
  shipped: "Shipped",
  meetup_set: "Meetup Set",
  delivered: "Delivered",
  completed: "Completed",
  disputed: "Disputed",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

const PAGE_SIZE = 10;

export default function PurchaseOrdersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "");

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await fetch("/api/dashboard/purchases", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (d.success) setOrders(d.data?.purchases ?? []);
    } catch {}
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      router.push("/dashboard");
      return;
    }
    fetchOrders();
  }, [user, fetchOrders, router]);

  if (!user) return null;

  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const rows = orders.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <button className={styles.iconBtn} onClick={() => router.push("/dashboard")} aria-label="Back to dashboard">
          ←
        </button>
        <h1 className={styles.title}>Order Purchase</h1>
        <span className={styles.topRight}>{orders.length}</span>
      </header>

      <div className={styles.body}>
        {loading ? (
          [...Array(4)].map((_, i) => <div key={i} className={styles.skeletonRow} />)
        ) : orders.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🛒</div>
            <div className={styles.emptyTitle}>No purchases yet</div>
            <div className={styles.emptyDesc}>Browse SupaMarket and make your first purchase.</div>
            <Link href="/supamarket" className={styles.emptyBtn}>
              Browse SupaMarket
            </Link>
          </div>
        ) : (
          <>
            {rows.map((order) => {
              const listing = order.listing;
              const href = order.legacy
                ? (order.listing_id ? `/supamarket/${order.listing_id}` : "/supamarket")
                : `/supamarket/orders/${order.id}`;
              return (
                <Link key={order.id} href={href} className={styles.orderRow}>
                  <div className={styles.orderImg}>
                    {listing?.images?.[0] ? (
                      <img src={listing.images[0]} alt="" className={styles.orderImgEl} />
                    ) : (
                      <span>🛍️</span>
                    )}
                  </div>
                  <div className={styles.orderInfo}>
                    <div className={styles.orderTitle}>{listing?.title ?? "Item"}</div>
                    <div className={styles.orderMeta}>
                      <span className={styles.orderPrice}>{parseFloat(order.amount_pi ?? 0).toFixed(2)} π</span>
                      <span className={styles.orderStatus}>{STATUS_META[order.status] ?? "Pending"}</span>
                    </div>
                    <div className={styles.orderSub}>
                      {order.legacy ? "Legacy purchase" : `Seller: @${order.seller?.username ?? "unknown"}`} · {timeAgo(order.created_at)}
                    </div>
                  </div>
                  <span className={styles.orderArrow}>{order.legacy ? "↗" : "→"}</span>
                </Link>
              );
            })}

            {totalPages > 1 && (
              <div className={styles.pager}>
                <button type="button" className={styles.pagerBtn} disabled={pageSafe === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  ← Prev
                </button>
                <span className={styles.pagerInfo}>Page {pageSafe} of {totalPages}</span>
                <button type="button" className={styles.pagerBtn} disabled={pageSafe === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
