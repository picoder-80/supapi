"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./page.module.css";

interface Order {
  id: string; status: string; buying_method: string; amount_pi: number;
  created_at: string; notes: string;
  listing: { id: string; title: string; images: string[]; category: string } | null;
  buyer: { id: string; username: string; display_name: string | null; avatar_url: string | null };
  seller: { id: string; username: string; display_name: string | null; avatar_url: string | null };
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: "Pending",     color: "#f39c12", bg: "rgba(243,156,18,0.1)" },
  paid:       { label: "Paid ✓",      color: "#27ae60", bg: "rgba(39,174,96,0.1)" },
  shipped:    { label: "Shipped 📦",  color: "#2980b9", bg: "rgba(41,128,185,0.1)" },
  meetup_set: { label: "Meetup Set 📍",color: "#8e44ad", bg: "rgba(142,68,173,0.1)" },
  delivered:  { label: "Delivered ✅",color: "#27ae60", bg: "rgba(39,174,96,0.1)" },
  completed:  { label: "Completed 🎉",color: "#27ae60", bg: "rgba(39,174,96,0.08)" },
  disputed:   { label: "Disputed ⚠️", color: "#e74c3c", bg: "rgba(231,76,60,0.1)" },
  refunded:   { label: "Refunded ↩️", color: "#7f8c8d", bg: "rgba(127,140,141,0.1)" },
  cancelled:  { label: "Cancelled",   color: "#95a5a6", bg: "rgba(149,165,166,0.1)" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }

export default function OrdersPage() {
  const { user } = useAuth();
  const router   = useRouter();
  const [role, setRole]       = useState<"buyer" | "seller">("buyer");
  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch_ = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("supapi_token");
        const r = await fetch(`/api/market/orders?role=${role}`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (d.success) setOrders(d.data);
      } catch {}
      setLoading(false);
    };
    fetch_();
  }, [user, role]);

  if (!user) return (
    <div className={styles.authWall}>
      <div className={styles.authIcon}>🔒</div>
      <div className={styles.authTitle}>Sign in to view orders</div>
      <button className={styles.authBtn} onClick={() => router.push("/dashboard")}>Sign In with Pi</button>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>← Back</button>
        <h1 className={styles.title}>My Orders</h1>
        <div />
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${role === "buyer" ? styles.tabActive : ""}`} onClick={() => setRole("buyer")}>
          🛒 Buying
        </button>
        <button className={`${styles.tab} ${role === "seller" ? styles.tabActive : ""}`} onClick={() => setRole("seller")}>
          🏪 Selling
        </button>
      </div>

      <div className={styles.body}>
        {loading ? (
          <div className={styles.loadingList}>
            {[...Array(3)].map((_,i) => <div key={i} className={styles.skeleton} />)}
          </div>
        ) : orders.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>{role === "buyer" ? "🛒" : "🏪"}</div>
            <div className={styles.emptyTitle}>No {role === "buyer" ? "purchases" : "sales"} yet</div>
            <div className={styles.emptyDesc}>{role === "buyer" ? "Browse the marketplace to find something!" : "Create a listing to start selling!"}</div>
            <Link href={role === "buyer" ? "/market" : "/market/create"} className={styles.emptyBtn}>
              {role === "buyer" ? "Browse Market →" : "+ Create Listing"}
            </Link>
          </div>
        ) : (
          <div className={styles.list}>
            {orders.map(order => {
              const status = STATUS_STYLE[order.status] ?? { label: order.status, color: "#7f8c8d", bg: "#f0f0f0" };
              const other  = role === "buyer" ? order.seller : order.buyer;
              return (
                <Link key={order.id} href={`/market/orders/${order.id}`} className={styles.orderCard}>
                  <div className={styles.orderImg}>
                    {order.listing?.images?.[0]
                      ? <img src={order.listing.images[0]} alt="" className={styles.orderImgEl} />
                      : <div className={styles.orderImgPlaceholder}>🛍️</div>
                    }
                  </div>
                  <div className={styles.orderInfo}>
                    <div className={styles.orderTitle}>{order.listing?.title ?? "Listing removed"}</div>
                    <div className={styles.orderPrice}>{Number(order.amount_pi).toFixed(2)} π</div>
                    <div className={styles.orderMeta}>
                      <div className={styles.orderPerson}>
                        <div className={styles.personAvatar}>
                          {other?.avatar_url
                            ? <img src={other.avatar_url} alt="" className={styles.personAvatarImg} />
                            : <span>{getInitial(other?.username ?? "?")}</span>
                          }
                        </div>
                        <span>{role === "buyer" ? "Seller" : "Buyer"}: {other?.display_name ?? other?.username}</span>
                      </div>
                      <span className={styles.orderTime}>{timeAgo(order.created_at)}</span>
                    </div>
                    <div className={styles.orderFooter}>
                      <span className={styles.orderMethod}>{order.buying_method === "ship" ? "📦 Ship" : "📍 Meetup"}</span>
                      <span className={styles.statusBadge} style={{ color: status.color, background: status.bg }}>{status.label}</span>
                    </div>
                  </div>
                  <div className={styles.orderArrow}>›</div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}