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

const SELLER_ACTION_STATUSES = new Set([
  "paid",
  "escrow",
  "shipped",
  "meetup_set",
  "delivered",
  "disputed",
]);

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
  const [recentPage, setRecentPage] = useState(1);
  const [recentFilter, setRecentFilter] = useState<
    "all" | "action" | "completed" | "disputed" | "pending" | "refunded" | "cancelled"
  >("all");
  const [searchOrderId, setSearchOrderId] = useState("");

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

  useEffect(() => {
    setRecentPage(1);
  }, [summary?.recentOrders?.length, summary?.actionRequiredOrders?.length, loadError, recentFilter, searchOrderId]);

  if (!user) return null;

  const RECENT_PAGE_SIZE = 10;
  const recentRows = summary?.recentOrders ?? [];
  const actionRows = summary?.actionRequiredOrders ?? [];
  const filterCounts = {
    all: recentRows.length,
    action: actionRows.length,
    pending: recentRows.filter((r) => String(r.status ?? "") === "pending").length,
    completed: recentRows.filter((r) => String(r.status ?? "") === "completed").length,
    disputed: recentRows.filter((r) => String(r.status ?? "") === "disputed").length,
    refunded: recentRows.filter((r) => String(r.status ?? "") === "refunded").length,
    cancelled: recentRows.filter((r) => String(r.status ?? "") === "cancelled").length,
  };
  const normalizedQuery = searchOrderId.trim().toLowerCase();
  const matchesSearch = (id: string) =>
    !normalizedQuery || id.toLowerCase().includes(normalizedQuery);
  const matchesFilter = (status: string) => {
    if (recentFilter === "all") return true;
    if (recentFilter === "completed") return status === "completed";
    if (recentFilter === "disputed") return status === "disputed";
    if (recentFilter === "pending") return status === "pending";
    if (recentFilter === "refunded") return status === "refunded";
    if (recentFilter === "cancelled") return status === "cancelled";
    if (recentFilter === "action") return SELLER_ACTION_STATUSES.has(status);
    return true;
  };
  const sourceRows = recentFilter === "action" ? actionRows : recentRows;
  const filteredRecentRows = sourceRows.filter((row) => {
    const s = String(row.status ?? "");
    return matchesFilter(s) && matchesSearch(String(row.id ?? ""));
  });
  const recentTotalPages = Math.max(1, Math.ceil(filteredRecentRows.length / RECENT_PAGE_SIZE));
  const recentPageSafe = Math.min(recentPage, recentTotalPages);
  const recentPageRows = filteredRecentRows.slice((recentPageSafe - 1) * RECENT_PAGE_SIZE, recentPageSafe * RECENT_PAGE_SIZE);

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <button type="button" className={styles.iconBtn} onClick={() => router.push("/dashboard")} aria-label="Back to dashboard">
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
          <div className={styles.heroHead}>
            <div>
              <h2 className={styles.heroTitle}>Seller Command Center</h2>
              <p className={styles.heroSub}>
                Real-time seller cockpit for inventory, pipeline, and payouts.
              </p>
            </div>
            <div className={styles.heroCtaStack}>
              <Link href="/supamarket/create" className={styles.heroCta}>
                + New listing
              </Link>
              <Link href="/supamarket/my-listings" className={styles.heroCta}>
                My listings
              </Link>
            </div>
          </div>
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
                <div className={styles.statLabel}>Pipeline live</div>
              </div>
              <div className={styles.statTile}>
                <div className={styles.statNum}>{summary.orders.attentionHint}</div>
                <div className={styles.statLabel}>Action queue</div>
              </div>
              <div className={styles.statTile}>
                <div className={styles.statNum}>
                  {summary.orders.completedGrossPi.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}π
                </div>
                <div className={styles.statLabel}>Completed gross</div>
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

        <div className={styles.workspace}>
          <section className={styles.mainCol}>
            {!loading && summary && summary.actionRequiredOrders.length > 0 && (
              <>
                <div>
                  <h3 className={styles.sectionTitle}>Needs action</h3>
                  <p className={styles.sectionHint}>
                    Orders that need seller follow-up (payment, shipping, meetup, or dispute).
                  </p>
                </div>
                <div className={styles.actionBanner}>
                  <span className={styles.actionBannerIcon}>⚡</span>
                  <div className={styles.actionBannerText}>
                    {summary.actionRequiredOrders.length}{" "}
                    {summary.actionRequiredOrders.length === 1 ? "order needs" : "orders need"} attention now.
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
                  <div className={styles.caughtUpTitle}>Inbox zero</div>
                  <p className={styles.caughtUpDesc}>No orders need seller action right now.</p>
                </div>
              </div>
            ) : null}

            <div className={styles.sectionHeadRow}>
              <div>
                <h3 className={styles.sectionTitle}>Recent selling orders</h3>
                <p className={styles.sectionHint}>
                  Latest timeline, including completed and refunded entries.
                </p>
              </div>
            </div>

            {!loading && summary && summary.recentOrders.length > 0 && (
              <div className={styles.filterBar}>
                <div className={styles.filterChips}>
                  {([
                    { id: "all", label: "All" },
                    { id: "action", label: "Action" },
                    { id: "pending", label: "Pending" },
                    { id: "completed", label: "Completed" },
                    { id: "disputed", label: "Disputed" },
                    { id: "refunded", label: "Refunded" },
                    { id: "cancelled", label: "Cancelled" },
                  ] as const).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`${styles.filterChip} ${recentFilter === f.id ? styles.filterChipActive : ""}`}
                      onClick={() => setRecentFilter(f.id)}
                    >
                      {f.label} ({filterCounts[f.id] ?? 0})
                    </button>
                  ))}
                </div>
                <input
                  className={styles.orderSearch}
                  placeholder="Search order ID..."
                  value={searchOrderId}
                  onChange={(e) => setSearchOrderId(e.target.value)}
                />
              </div>
            )}

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
                    No other orders right now — all active orders are listed under "Needs action".
                  </p>
                ) : filteredRecentRows.length === 0 ? (
                  <div className={styles.emptyMuted}>
                    <p className={styles.emptyMutedText}>No orders match current filter/search.</p>
                  </div>
                ) : (
                  <>
                    {recentPageRows.map((order) => (
                      <OrderRowLink key={order.id} order={order} variant="recent" />
                    ))}
                    {recentTotalPages > 1 && (
                      <div className={styles.pager}>
                        <button
                          type="button"
                          className={styles.pagerBtn}
                          disabled={recentPageSafe === 1}
                          onClick={() => setRecentPage((p) => Math.max(1, p - 1))}
                        >
                          ← Prev
                        </button>
                        <span className={styles.pagerInfo}>
                          Page {recentPageSafe} of {recentTotalPages}
                        </span>
                        <button
                          type="button"
                          className={styles.pagerBtn}
                          disabled={recentPageSafe === recentTotalPages}
                          onClick={() => setRecentPage((p) => Math.min(recentTotalPages, p + 1))}
                        >
                          Next →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </section>

          <aside className={styles.sideCol}>
            <div className={styles.sideCard}>
              <h3 className={styles.sideTitle}>Inventory snapshot</h3>
              <p className={styles.sectionHint}>
                {loading || !summary
                  ? "…"
                  : `Total ${summary.listings.total} · Active ${summary.listings.active} · Paused ${summary.listings.paused} · Sold ${summary.listings.sold}${
                      summary.listings.other ? ` · Other ${summary.listings.other}` : ""
                    }`}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
