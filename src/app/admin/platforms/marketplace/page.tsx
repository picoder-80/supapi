"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import styles from "./page.module.css";

interface Stats {
  listings: { total: number; active: number };
  orders: { total: number; pending: number; completed: number; disputed: number };
  revenue: { total_pi: number; commission_pct: number; estimated_commission: number };
  recent_orders: any[];
}

const STATUS_COLOR: Record<string,string> = {
  pending:"#f39c12", paid:"#27ae60", shipped:"#2980b9",
  completed:"#27ae60", disputed:"#e74c3c", refunded:"#7f8c8d", cancelled:"#95a5a6",
};

const TABS = [
  { key:"listings",   icon:"🛍️", label:"Listings",   href:"/admin/supamarket#listings"   },
  { key:"orders",     icon:"📦", label:"Orders",     href:"/admin/supamarket#orders"     },
  { key:"disputes",   icon:"⚖️", label:"Disputes",   href:"/admin/supamarket#disputes"   },
  { key:"users",      icon:"👥", label:"Users",      href:"/admin/supamarket#users"      },
  { key:"commission", icon:"💰", label:"Commission", href:"/admin/supamarket#commission" },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-MY",{day:"numeric",month:"short"});
}

const PAGE_SIZE = 10;

export default function MarketplaceAdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentOrdersPage, setRecentOrdersPage] = useState(1);

  const adminFetch = useCallback(async (url: string) => {
    const token = localStorage.getItem("supapi_admin_token") ?? "";
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }, []);

  useEffect(() => {
    adminFetch("/api/admin/supamarket/stats")
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d.data); })
      .finally(() => setLoading(false));
  }, [adminFetch]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.platformIcon}>🛍️</span>
          <div>
            <h1 className={styles.title}>SupaMarket</h1>
            <p className={styles.sub}>Pi-powered buy & sell platform</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Link href="/admin/supamarket" className={styles.fullAdminBtn}>Full Admin Panel →</Link>
          <Link href="/admin/dashboard" className={`${styles.backBtn} ${styles.topBackBtn}`}>Back to Dashboard</Link>
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <div className={styles.loadingRow}>
          {[...Array(4)].map((_,i) => <div key={i} className={styles.skeleton} />)}
        </div>
      ) : stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statVal} style={{color:"#F5A623"}}>{stats.listings.active}</div>
            <div className={styles.statLbl}>Active Listings</div>
            <div className={styles.statSub}>of {stats.listings.total} total</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statVal}>{stats.orders.total}</div>
            <div className={styles.statLbl}>Total Orders</div>
            <div className={styles.statSub}>{stats.orders.pending} pending</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statVal} style={{color: stats.orders.disputed > 0 ? "#e74c3c":"#27ae60"}}>{stats.orders.disputed}</div>
            <div className={styles.statLbl}>Disputes</div>
            <div className={styles.statSub}>{stats.orders.disputed > 0 ? "needs attention":"all clear ✓"}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statVal} style={{color:"#F5A623"}}>{stats.revenue.total_pi.toFixed(2)} π</div>
            <div className={styles.statLbl}>Total GMV</div>
            <div className={styles.statSub}>@ {stats.revenue.commission_pct}% commission</div>
          </div>
        </div>
      )}

      {/* Quick nav tabs */}
      <div className={styles.tabGrid}>
        {TABS.map(t => (
          <Link key={t.key} href={t.href} className={styles.tabCard}>
            <span className={styles.tabIcon}>{t.icon}</span>
            <span className={styles.tabLabel}>{t.label}</span>
            <span className={styles.tabArrow}>→</span>
          </Link>
        ))}
      </div>

      {/* Recent orders — 10 per page */}
      {stats?.recent_orders?.length ? (
        <div className={styles.section}>
          <div className={styles.sectionRow}>
            <div className={styles.sectionTitle}>Recent Orders</div>
            <Link href="/admin/supamarket#orders" className={styles.seeAll}>See all →</Link>
          </div>
          {(() => {
            const list = stats.recent_orders ?? [];
            const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
            const pageSafe = Math.min(recentOrdersPage, totalPages);
            const pageList = list.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
            return (
              <>
                <div className={styles.orderList}>
                  {pageList.map((o: any) => (
                    <div key={o.id} className={styles.orderRow}>
                      <div className={styles.orderInfo}>
                        <div className={styles.orderTitle}>{o.listing?.title ?? "—"}</div>
                        <div className={styles.orderMeta}>@{o.buyer?.username} · {fmtDate(o.created_at)}</div>
                      </div>
                      <div className={styles.orderRight}>
                        <div className={styles.orderAmt}>{Number(o.amount_pi).toFixed(2)} π</div>
                        <span className={styles.badge} style={{ color: STATUS_COLOR[o.status] ?? "#999", background: `${STATUS_COLOR[o.status] ?? "#999"}18` }}>{o.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className={styles.pager}>
                    <button type="button" className={styles.pagerBtn} disabled={pageSafe === 1} onClick={() => setRecentOrdersPage((p) => Math.max(1, p - 1))}>← Prev</button>
                    <span className={styles.pagerInfo}>Page {pageSafe} of {totalPages}</span>
                    <button type="button" className={styles.pagerBtn} disabled={pageSafe === totalPages} onClick={() => setRecentOrdersPage((p) => Math.min(totalPages, p + 1))}>Next →</button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      ) : null}

      {/* Status note */}
      <div className={styles.statusNote}>
        ✅ SupaMarket is <strong>LIVE</strong> — Full admin panel available at{" "}
        <Link href="/admin/supamarket" className={styles.statusLink}>/admin/supamarket</Link>
      </div>

      <div className={styles.quickLinks}>
        <Link href="/admin/dashboard" className={`${styles.backBtn} ${styles.bottomBackBtn}`}>Back to Dashboard</Link>
      </div>
    </div>
  );
}