"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./page.module.css";

const STATUS_LABEL: Record<string, string> = {
  pending:    "Pending payment",
  escrow:     "Paid",
  paid:       "Paid",
  shipped:    "Shipped",
  meetup_set: "Meetup set",
  delivered:  "Delivered",
  completed:  "Completed",
  disputed:   "Disputed",
  refunded:   "Refunded",
  cancelled:  "Cancelled",
};

const STATUS_CLASS: Record<string, string> = {
  pending:    styles.statusPending,
  paid:       styles.statusPaid,
  escrow:     styles.statusPaid,
  shipped:    styles.statusShipped,
  meetup_set: styles.statusMeetup,
  delivered:  styles.statusDelivered,
  completed:  styles.statusCompleted,
  disputed:   styles.statusDisputed,
  refunded:   styles.statusRefunded,
  cancelled:  styles.statusCancelled,
};

interface OrderRowItem {
  id: string;
  status: string;
  amount_pi: number;
  created_at: string;
  updated_at?: string;
  title: string;
  image: string | null;
  hint?: string | null;
}

interface Summary {
  listings: { total: number; active: number; paused: number; sold: number; other: number };
  orders: {
    total: number;
    byStatus: Record<string, number>;
    activePipeline: number;
    attentionHint: number;
    completedGrossPi: number;
  };
  recentOrders: OrderRowItem[];
  actionRequiredOrders: OrderRowItem[];
}

/** Status keys shown as pipeline chips (seller-facing labels). */
const PIPELINE_CHIPS: { key: string; label: string }[] = [
  { key: "pending", label: "Awaiting payment" },
  { key: "paid", label: "Paid — fulfill" },
  { key: "escrow", label: "In escrow" },
  { key: "shipped", label: "Shipped" },
  { key: "meetup_set", label: "Meetup set" },
  { key: "delivered", label: "Delivered" },
  { key: "disputed", label: "Dispute" },
  { key: "completed", label: "Completed" },
  { key: "refunded", label: "Refunded" },
  { key: "cancelled", label: "Cancelled" },
];

function timeAgo(iso: string) {
  const t = Date.now() - new Date(iso).getTime();
  if (t < 0) return "Just now";
  const mins = Math.floor(t / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const d = Math.floor(hrs / 24);
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

function OrderRowLink({ order, variant }: { order: OrderRowItem; variant: "action" | "recent" }) {
  const label = STATUS_LABEL[order.status] ?? order.status;
  const sc = STATUS_CLASS[order.status] ?? styles.statusPending;
  const sub =
    variant === "action" && order.updated_at && order.updated_at !== order.created_at
      ? `Updated ${timeAgo(order.updated_at)} · ${timeAgo(order.created_at)}`
      : timeAgo(order.created_at);
  return (
    <Link
      href={`/supamarket/orders/${order.id}`}
      className={`${styles.orderRow} ${variant === "action" ? styles.orderRowAction : ""}`}
    >
      <div className={styles.orderImg}>
        {order.image ? <img src={order.image} alt="" className={styles.orderImgEl} /> : <span>🛍️</span>}
      </div>
      <div className={styles.orderInfo}>
        <div className={styles.orderTitle}>{order.title}</div>
        <div className={styles.orderMeta}>
          <span className={styles.orderPrice}>{order.amount_pi.toFixed(2)} π</span>
          <span className={`${styles.orderStatus} ${sc}`}>{label}</span>
        </div>
        {order.hint ? <div className={styles.orderHint}>{order.hint}</div> : null}
        <div className={styles.orderSub}>{sub}</div>
      </div>
      <span className={styles.orderArrow}>→</span>
    </Link>
  );
}

export default function SellerHubPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "");

  const fetchSummary = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!user) return;
      const silent = Boolean(opts?.silent);
      if (silent) setRefreshing(true);
      else setLoading(true);
      setLoadError(null);
      try {
        const r = await fetch("/api/supamarket/seller/summary", {
          headers: { Authorization: `Bearer ${token()}` },
        });
        const d = await r.json();
        if (d.success && d.data) {
          setSummary({
            ...d.data,
            actionRequiredOrders: Array.isArray(d.data.actionRequiredOrders) ? d.data.actionRequiredOrders : [],
            recentOrders:         Array.isArray(d.data.recentOrders) ? d.data.recentOrders : [],
          });
        } else {
          if (!silent) setSummary(null);
          setLoadError(typeof d.error === "string" ? d.error : "Could not load seller data");
        }
      } catch {
        if (!silent) setSummary(null);
        setLoadError("Network error — check your connection and try again.");
      }
      if (silent) setRefreshing(false);
      else setLoading(false);
    },
    [user]
  );

  useEffect(() => {
    if (!user) {
      router.push("/dashboard");
      return;
    }
    fetchSummary();
  }, [user, fetchSummary, router]);

  if (!user) return null;

  const pipelineChips = summary
    ? PIPELINE_CHIPS.map(({ key, label }) => {
        const n = summary.orders.byStatus[key] ?? 0;
        return n > 0 ? { key, label, n } : null;
      }).filter(Boolean) as { key: string; label: string; n: number }[]
    : [];

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <button type="button" className={styles.iconBtn} onClick={() => router.back()} aria-label="Go back">
          ←
        </button>
        <div className={styles.topBarCenter}>
          <h1 className={styles.title}>Seller Hub</h1>
          <p className={styles.subtitle}>
            SupaMarket · @{user.username}
            {!loading && summary && summary.actionRequiredOrders.length > 0 ? (
              <span className={styles.headerBadge} aria-hidden>
                {summary.actionRequiredOrders.length}
              </span>
            ) : null}
          </p>
        </div>
        <div className={styles.topBarRight}>
          <button
            type="button"
            className={`${styles.iconBtn} ${refreshing ? styles.iconBtnBusy : ""}`}
            onClick={() => void fetchSummary({ silent: true })}
            disabled={refreshing || loading}
            aria-label="Refresh"
          >
            ↻
          </button>
          <Link href="/supamarket/create" className={styles.iconBtn} aria-label="New listing">
            ＋
          </Link>
        </div>
      </header>

      <div className={styles.body}>
        <section className={styles.heroCard}>
          <div
            className={`${styles.heroRefreshing} ${refreshing ? styles.heroRefreshingVisible : ""}`}
            aria-hidden
          />
          <h2 className={styles.heroTitle}>Sales overview</h2>
          <p className={styles.heroSub}>
            Track listings, orders in progress, and jump to actions (tracking, meetup, disputes) from one screen.
          </p>
          {loading || !summary ? (
            <div className={styles.grid2}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={styles.statTile} style={{ minHeight: 72 }} />
              ))}
            </div>
          ) : (
            <div className={styles.grid2}>
              <div className={styles.statTile}>
                <div className={styles.statNum}>{summary.listings.active}</div>
                <div className={styles.statLabel}>Active listings</div>
              </div>
              <div className={styles.statTile}>
                <div className={styles.statNum}>{summary.orders.activePipeline}</div>
                <div className={styles.statLabel}>Open orders</div>
              </div>
              <div className={styles.statTile}>
                <div className={styles.statNum}>{summary.orders.attentionHint}</div>
                <div className={styles.statLabel}>Need follow-up</div>
              </div>
              <div className={styles.statTile}>
                <div className={styles.statNum}>
                  {summary.orders.completedGrossPi.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}π
                </div>
                <div className={styles.statLabel}>Completed (gross)</div>
              </div>
            </div>
          )}
        </section>

        {loadError ? (
          <div className={styles.errorBanner} role="alert">
            <span className={styles.errorBannerText}>{loadError}</span>
            <button type="button" className={styles.errorRetry} onClick={() => void fetchSummary()}>
              Retry
            </button>
          </div>
        ) : null}

        {!loading && summary && summary.listings.total === 0 ? (
          <div className={styles.tipCard}>
            <span className={styles.tipIcon}>💡</span>
            <div>
              <div className={styles.tipTitle}>Start selling</div>
              <p className={styles.tipDesc}>
                Create a listing so buyers can find you on SupaMarket.
              </p>
            </div>
          </div>
        ) : null}

        {summary && summary.orders.total > 0 && pipelineChips.length > 0 ? (
          <section className={styles.pipelineSection} aria-label="Order status breakdown">
            <h3 className={styles.sectionTitle}>Orders by status</h3>
            <p className={styles.sectionHint}>Counts from your latest orders (up to 80 shown in this summary).</p>
            <div className={styles.pipelineRow}>
              {pipelineChips.map(({ key, label, n }) => (
                <span key={key} className={styles.pipelineChip}>
                  <span className={styles.pipelineChipN}>{n}</span>
                  <span className={styles.pipelineChipLabel}>{label}</span>
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <div>
          <h3 className={styles.sectionTitle}>Listings</h3>
          <p className={styles.sectionHint}>
            {loading || !summary
              ? "…"
              : `Total ${summary.listings.total} · Paused ${summary.listings.paused} · Sold ${summary.listings.sold}${
                  summary.listings.other ? ` · Other ${summary.listings.other}` : ""
                }`}
          </p>
        </div>

        <div className={styles.actions}>
          <Link href="/supamarket/create" className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}>
            ＋ New listing
          </Link>
          <Link href="/supamarket/my-listings" className={styles.actionBtn}>
            📋 My listings
          </Link>
          <Link href="/supamarket/orders?tab=selling" className={styles.actionBtn}>
            🏷️ All selling orders
          </Link>
          <Link href="/wallet" className={styles.actionBtn}>
            💰 Earnings wallet
          </Link>
        </div>

        {!loading && summary && summary.actionRequiredOrders.length > 0 && (
          <>
            <div>
              <h3 className={styles.sectionTitle}>Needs action</h3>
              <p className={styles.sectionHint}>
                Orders that need seller follow-up (payment received, shipping, meetup, or dispute).
              </p>
            </div>
            <div className={styles.actionBanner}>
              <span className={styles.actionBannerIcon}>⚡</span>
              <div className={styles.actionBannerText}>
                {summary.actionRequiredOrders.length}{" "}
                {summary.actionRequiredOrders.length === 1 ? "order needs" : "orders need"} attention — tap to update
                tracking or meetup, or open a dispute.
              </div>
            </div>
            {summary.actionRequiredOrders.map((order) => (
              <OrderRowLink key={order.id} order={order} variant="action" />
            ))}
          </>
        )}

        {!loading && summary && summary.orders.total > 0 && summary.actionRequiredOrders.length === 0 ? (
          <div className={styles.caughtUp}>
            <span className={styles.caughtUpIcon}>✓</span>
            <div>
              <div className={styles.caughtUpTitle}>You&apos;re all caught up</div>
              <p className={styles.caughtUpDesc}>No orders need seller action right now.</p>
            </div>
          </div>
        ) : null}

        <div className={styles.sectionHeadRow}>
          <div>
            <h3 className={styles.sectionTitle}>Recent orders (selling)</h3>
            <p className={styles.sectionHint}>
              Latest orders (not shown under &quot;Needs action&quot;). Tap for full details.
            </p>
          </div>
          {!loading && summary && summary.orders.total > 0 ? (
            <Link href="/supamarket/orders?tab=selling" className={styles.sectionLink}>
              View all
            </Link>
          ) : null}
        </div>

        {loading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={styles.skeletonRow} />
            ))}
          </>
        ) : loadError ? (
          <div className={styles.emptyMuted}>
            <p className={styles.emptyMutedText}>Fix the error above, then tap Retry or refresh.</p>
          </div>
        ) : !summary ||
          (summary.recentOrders.length === 0 && summary.actionRequiredOrders.length === 0) ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🏷️</div>
            <div className={styles.emptyTitle}>No seller orders yet</div>
            <div className={styles.emptyDesc}>Create your first listing and share your SupaMarket link.</div>
            <Link href="/supamarket/create" className={styles.emptyBtn}>
              Create listing
            </Link>
          </div>
        ) : (
          <>
            {summary.recentOrders.length === 0 ? (
              <p className={styles.sectionHint} style={{ marginTop: 0 }}>
                No other orders right now — all active orders are listed under &quot;Needs action&quot; above.
              </p>
            ) : (
              summary.recentOrders.map((order) => <OrderRowLink key={order.id} order={order} variant="recent" />)
            )}
          </>
        )}
      </div>
    </div>
  );
}
