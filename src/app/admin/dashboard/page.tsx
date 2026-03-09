"use client";

// app/admin/dashboard/page.tsx

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import styles from "./page.module.css";

interface Stats {
  listings: { total: number; active: number };
  orders: { total: number; pending: number; completed: number; disputed: number };
  revenue: { total_pi: number; commission_pct: number; estimated_commission: number };
  recent_orders: any[];
}
interface Analytics {
  days: { date: string; orders: number; revenue: number; completed: number }[];
  categories: { name: string; count: number }[];
  top_sellers: { seller_id: string; total: number; count: number; info: { username: string; display_name: string | null; avatar_url: string | null } }[];
}
interface Commission {
  commission_pct: number;
  total_collected_pi: number;
  total_pending_pi: number;
}

const ADMIN_TOOLS = [
  { href: "/admin/users", icon: "👥", label: "Global Users", sub: "Ban · Verify · Manage all users" },
];

const PLATFORMS = [
  { href: "/admin/platforms/marketplace", icon: "🛍️", label: "Marketplace"  },
  { href: "/admin/platforms/gigs",        icon: "💼", label: "Gigs"          },
  { href: "/admin/platforms/academy",     icon: "📚", label: "Academy"       },
  { href: "/admin/platforms/stay",        icon: "🏡", label: "Stay"          },
  { href: "/admin/platforms/arcade",      icon: "🎮", label: "Arcade"        },
  { href: "/admin/platforms/newsfeed",     icon: "📰", label: "Newsfeed"      },
  { href: "/admin/platforms/wallet",      icon: "💰", label: "Wallet"        },
  { href: "/admin/platforms/referral",    icon: "🤝", label: "Referral"      },
  { href: "/admin/platforms/locator",     icon: "📍", label: "Locator"       },
  { href: "/admin/platforms/jobs",        icon: "🧑‍💻", label: "Jobs"          },
  { href: "/admin/platforms/rewards",     icon: "🎁", label: "Rewards"       },
  { href: "/admin/platforms/reels",       icon: "🎬", label: "Reels"         },
  { href: "/admin/platforms/pi-value",    icon: "📈", label: "Pi Value"      },
  { href: "/admin/platforms/classifieds", icon: "📋", label: "Classifieds"   },
  { href: "/admin/platforms/myspace",     icon: "🪐", label: "MySpace"       },
];

const STATUS_COLOR: Record<string, string> = {
  pending:"#f39c12", paid:"#27ae60", shipped:"#2980b9",
  completed:"#27ae60", disputed:"#e74c3c", refunded:"#7f8c8d", cancelled:"#95a5a6",
};

function Badge({ status }: { status: string }) {
  const c = STATUS_COLOR[status] ?? "#999";
  return <span className={styles.badge} style={{ color:c, background:`${c}18`, border:`1px solid ${c}30` }}>{status}</span>;
}

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-MY", { day:"numeric", month:"short" });
}

function MiniChart({ days, valueKey, color }: { days: any[]; valueKey: string; color: string }) {
  const max = Math.max(...days.map(d => d[valueKey]), 1);
  return (
    <div className={styles.miniChart}>
      {days.map((d, i) => (
        <div key={i} className={styles.miniBar}
          style={{ height: `${Math.max(4, (d[valueKey] / max) * 100)}%`, background: color }} />
      ))}
    </div>
  );
}

// Safe fetch — never throws, returns null on error
async function safeFetch(url: string, token: string): Promise<any> {
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const text = await r.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function AdminDashboardPage() {
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [analytics,  setAnalytics]  = useState<Analytics | null>(null);
  const [commission, setCommission] = useState<Commission | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [exporting,  setExporting]  = useState<string | null>(null);

  const adminFetch = useCallback(async (url: string) => {
    const token = localStorage.getItem("supapi_admin_token") ?? "";
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }, []);

  useEffect(() => {
    setLoading(true);
    const token = localStorage.getItem("supapi_admin_token") ?? "";
    Promise.all([
      safeFetch("/api/admin/market/stats",      token),
      safeFetch("/api/admin/market/analytics",  token),
      safeFetch("/api/admin/market/commission", token),
    ]).then(([s, a, c]) => {
      if (s?.success) setStats(s.data);
      if (a?.success) setAnalytics(a.data);
      if (c?.success) setCommission(c.data);
    }).finally(() => setLoading(false));
  }, []);

  const exportCSV = async (type: string) => {
    setExporting(type);
    try {
      const r    = await adminFetch(`/api/admin/market/export?type=${type}`);
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `supapi_${type}_${Date.now()}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch {}
    setExporting(null);
  };

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Admin Dashboard</h1>
          <p className={styles.sub}>Full control across all 15 platforms</p>
        </div>
        <div className={styles.liveTag}>● LIVE</div>
      </div>

      {/* ── Shortcut to user dashboard ── */}
      <Link href="/dashboard" className={styles.userBanner}>
        <div className={styles.userBannerLeft}>
          <span className={styles.userBannerIcon}>🪐</span>
          <div>
            <div className={styles.userBannerTitle}>My Pi Dashboard</div>
            <div className={styles.userBannerSub}>View your personal user dashboard</div>
          </div>
        </div>
        <span className={styles.userBannerArrow}>→</span>
      </Link>

      {/* ── Stats Grid ── */}
      {loading ? (
        <div className={styles.loadingRow}>
          {[...Array(6)].map((_,i) => <div key={i} className={styles.skeleton} />)}
        </div>
      ) : stats ? (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statValue} style={{color:"#F5A623"}}>{stats.listings.active}</div>
            <div className={styles.statLabel}>Active Listings</div>
            <div className={styles.statSub}>of {stats.listings.total} total</div>
            {analytics && <MiniChart days={analytics.days.slice(-14)} valueKey="orders" color="rgba(245,166,35,0.4)" />}
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.orders.total}</div>
            <div className={styles.statLabel}>Total Orders</div>
            <div className={styles.statSub}>{stats.orders.pending} pending</div>
            {analytics && <MiniChart days={analytics.days.slice(-14)} valueKey="orders" color="rgba(255,255,255,0.3)" />}
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue} style={{color:"#27ae60"}}>{stats.orders.completed}</div>
            <div className={styles.statLabel}>Completed Sales</div>
            <div className={styles.statSub}>successfully delivered</div>
            {analytics && <MiniChart days={analytics.days.slice(-14)} valueKey="completed" color="rgba(39,174,96,0.5)" />}
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue} style={{color: stats.orders.disputed > 0 ? "#e74c3c" : "#27ae60"}}>{stats.orders.disputed}</div>
            <div className={styles.statLabel}>Open Disputes</div>
            <div className={styles.statSub}>{stats.orders.disputed > 0 ? "needs attention" : "all clear ✓"}</div>
            {stats.orders.disputed > 0 && (
              <Link href="/admin/platforms/marketplace" className={styles.statAction}>Review →</Link>
            )}
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue} style={{color:"#F5A623"}}>{stats.revenue.total_pi.toFixed(2)} π</div>
            <div className={styles.statLabel}>Total GMV</div>
            <div className={styles.statSub}>gross merchandise value</div>
            {analytics && <MiniChart days={analytics.days.slice(-14)} valueKey="revenue" color="rgba(245,166,35,0.4)" />}
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue} style={{color:"#2980b9"}}>{stats.revenue.estimated_commission.toFixed(3)} π</div>
            <div className={styles.statLabel}>Est. Commission</div>
            <div className={styles.statSub}>@ {stats.revenue.commission_pct}% rate</div>
            {commission && <div className={styles.statSub}>collected: {Number(commission.total_collected_pi).toFixed(3)} π</div>}
          </div>
        </div>
      ) : (
        <div className={styles.apiWarn}>⚠️ Could not load stats — check API routes</div>
      )}

      {/* ── Admin Tools ── */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Admin Tools</h2>
        <div className={styles.toolGrid}>
          {ADMIN_TOOLS.map(t => (
            <Link key={t.href} href={t.href} className={styles.toolCard}>
              <span className={styles.toolIcon}>{t.icon}</span>
              <div className={styles.toolText}>
                <div className={styles.toolLabel}>{t.label}</div>
                <div className={styles.toolSub}>{t.sub}</div>
              </div>
              <span className={styles.toolArrow}>→</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Recent Orders ── */}
      {stats?.recent_orders?.length ? (
        <div className={styles.section}>
          <div className={styles.sectionRow}>
            <h2 className={styles.sectionTitle}>Recent Orders</h2>
            <Link href="/admin/platforms/marketplace" className={styles.seeAll}>See all →</Link>
          </div>
          <div className={styles.orderList}>
            {stats.recent_orders.map((o: any) => (
              <div key={o.id} className={styles.orderRow}>
                <div className={styles.orderInfo}>
                  <div className={styles.orderTitle}>{o.listing?.title ?? "—"}</div>
                  <div className={styles.orderMeta}>@{o.buyer?.username} · {fmtDate(o.created_at)}</div>
                </div>
                <div className={styles.orderRight}>
                  <div className={styles.orderAmt}>{Number(o.amount_pi).toFixed(2)} π</div>
                  <Badge status={o.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Category Breakdown ── */}
      {analytics?.categories?.length ? (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Listings by Category</h2>
          <div className={styles.catGrid}>
            {analytics.categories.map(c => (
              <div key={c.name} className={styles.catRow}>
                <span className={styles.catName}>{c.name}</span>
                <div className={styles.catBar}>
                  <div className={styles.catFill}
                    style={{ width: `${Math.max(4, (c.count / (analytics.categories[0]?.count || 1)) * 100)}%` }} />
                </div>
                <span className={styles.catCount}>{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Top Sellers ── */}
      {analytics?.top_sellers?.length ? (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Top Sellers</h2>
          <div className={styles.sellerList}>
            {analytics.top_sellers.map((s, i) => (
              <Link key={s.seller_id} href={`/admin/users/${s.seller_id}`} className={styles.sellerRow}>
                <div className={styles.sellerRank}>#{i + 1}</div>
                <div className={styles.sellerAvatar}>
                  {s.info?.avatar_url
                    ? <img src={s.info.avatar_url} alt="" className={styles.sellerAvatarImg} />
                    : <span>{getInitial(s.info?.username ?? "?")}</span>
                  }
                </div>
                <div className={styles.sellerInfo}>
                  <div className={styles.sellerName}>{s.info?.display_name ?? s.info?.username}</div>
                  <div className={styles.sellerSub}>{s.count} completed sales</div>
                </div>
                <div className={styles.sellerRevenue}>{s.total.toFixed(2)} π</div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Export ── */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Export Data</h2>
        <div className={styles.exportRow}>
          {["orders","listings","commissions"].map(t => (
            <button key={t} className={styles.exportBtn} disabled={exporting === t} onClick={() => exportCSV(t)}>
              {exporting === t ? "⏳ Exporting..." : `📥 ${t.charAt(0).toUpperCase() + t.slice(1)} CSV`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Platform Administration ── */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Platform Administration</h2>
        <div className={styles.platformGrid}>
          {PLATFORMS.map(p => (
            <Link key={p.href} href={p.href} className={styles.platformCard}>
              <span className={styles.platformEmoji}>{p.icon}</span>
              <span className={styles.platformLabel}>{p.label}</span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}