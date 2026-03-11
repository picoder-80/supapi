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

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: "Pending",    color: "#744210", bg: "#FFFAF0" },
  paid:       { label: "Paid",       color: "#276749", bg: "#F0FFF4" },
  shipped:    { label: "Shipped",    color: "#2B6CB0", bg: "#EBF8FF" },
  meetup_set: { label: "Meetup Set", color: "#553C9A", bg: "#FAF5FF" },
  delivered:  { label: "Delivered",  color: "#276749", bg: "#F0FFF4" },
  completed:  { label: "Completed",  color: "#2D3748", bg: "#EDF2F7" },
  disputed:   { label: "Disputed",   color: "#9B2335", bg: "#FFF5F5" },
  refunded:   { label: "Refunded",   color: "#2B6CB0", bg: "#EBF8FF" },
  cancelled:  { label: "Cancelled",  color: "#A0AEC0", bg: "#F7FAFC" },
};

export default function OrdersPage() {
  const { user }  = useAuth();
  const router    = useRouter();
  const [tab, setTab]           = useState<"buying"|"selling">("buying");
  const [orders, setOrders]     = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  const token = () => typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "";

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/market/orders?role=${tab === "buying" ? "buyer" : "seller"}`, {
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

  if (!user) return null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>← Back</button>
        <h1 className={styles.title}>My Orders</h1>
        <div />
      </div>

      <div className={styles.tabs}>
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
            <Link href={tab === "buying" ? "/market" : "/market/create"} className={styles.emptyBtn}>
              {tab === "buying" ? "Browse Marketplace" : "Create Listing"}
            </Link>
          </div>
        ) : (
          orders.map(order => {
            const meta    = STATUS_META[order.status] ?? STATUS_META.pending;
            const listing = order.listing;
            const other   = tab === "buying" ? order.seller : order.buyer;
            return (
              <Link key={order.id} href={`/market/orders/${order.id}`} className={styles.orderRow}>
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
                    <span className={styles.orderStatus} style={{ color: meta.color, background: meta.bg }}>
                      {meta.label}
                    </span>
                  </div>
                  <div className={styles.orderSub}>
                    {tab === "buying" ? "Seller" : "Buyer"}: @{other?.username} · {timeAgo(order.created_at)}
                  </div>
                </div>
                <span className={styles.orderArrow}>→</span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
