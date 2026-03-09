"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "./page.module.css";

interface Analytics {
  days: { date: string; orders: number; revenue: number; completed: number }[];
  categories: { name: string; count: number }[];
  statuses: { status: string; count: number }[];
  top_sellers: { seller_id: string; total: number; count: number; info: { username: string; display_name: string | null; avatar_url: string | null } }[];
}
interface Stats {
  listings: { total: number; active: number };
  orders: { total: number; pending: number; completed: number; disputed: number };
  revenue: { total_pi: number; commission_pct: number; estimated_commission: number };
}

const STATUS_COLOR: Record<string, string> = {
  pending:"#f39c12", paid:"#27ae60", shipped:"#2980b9", completed:"#27ae60",
  disputed:"#e74c3c", refunded:"#7f8c8d", cancelled:"#95a5a6",
};
const CAT_EMOJI: Record<string, string> = {
  electronics:"📱", home_personal:"🏡", autos:"🚗", leisure:"⛷️",
  property:"🏠", jobs_services:"💼", food:"🍜", pets:"🐾",
  travel:"✈️", b2b:"🏢", swap:"🔄", others:"📦",
};

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth()+1}`;
}

// Inline mini bar chart
function BarChart({ data, valueKey, labelKey, color = "#F5A623" }: { data: any[]; valueKey: string; labelKey: string; color?: string }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div className={styles.barChart}>
      {data.map((d, i) => (
        <div key={i} className={styles.barCol}>
          <div className={styles.barWrap}>
            <div className={styles.bar} style={{ height: `${(d[valueKey] / max) * 100}%`, background: color }} />
          </div>
          {i % 5 === 0 && <div className={styles.barLabel}>{d[labelKey]}</div>}
        </div>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const [token, setToken]         = useState("");
  const [stats, setStats]         = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading]     = useState(true);
  const [commPct, setCommPct]     = useState(5);
  const [exporting, setExporting] = useState<string | null>(null);
  const [isAdmin, setIsAdmin]     = useState(false);
  const [adminPass, setAdminPass] = useState("");
  const [loginErr, setLoginErr]   = useState("");

  useEffect(() => {
    const t = localStorage.getItem("supapi_token") ?? "";
    setToken(t);
    const adminFlag = sessionStorage.getItem("supapi_admin_ok");
    if (adminFlag === "1") setIsAdmin(true);
  }, []);

  const adminFetch = useCallback(async (url: string, opts?: RequestInit) =>
    fetch(url, { ...opts, headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}`, ...(opts?.headers ?? {}) } }), [token]);

  useEffect(() => {
    if (!token || !isAdmin) return;
    setLoading(true);
    Promise.all([
      adminFetch("/api/admin/market/stats").then(r => r.json()),
      adminFetch("/api/admin/market/analytics").then(r => r.json()),
      adminFetch("/api/admin/market/commission").then(r => r.json()),
    ]).then(([s, a, c]) => {
      if (s.success) setStats(s.data);
      if (a.success) setAnalytics(a.data);
      if (c.success) setCommPct(c.data.commission_pct);
    }).finally(() => setLoading(false));
  }, [token, isAdmin, adminFetch]);

  const handleLogin = () => {
    // Simple admin password check (set your own)
    if (adminPass === "Admin@Supapi123") {
      sessionStorage.setItem("supapi_admin_ok", "1");
      setIsAdmin(true); setLoginErr("");
    } else { setLoginErr("Invalid password"); }
  };

  const exportCSV = async (type: string) => {
    setExporting(type);
    try {
      const r = await adminFetch(`/api/admin/market/export?type=${type}`);
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `supapi_${type}_${Date.now()}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch {}
    setExporting(null);
  };

  // Login wall
  if (!isAdmin) return (
    <div className={styles.loginPage}>
      <div className={styles.loginCard}>
        <div className={styles.loginLogo}>🛡️</div>
        <div className={styles.loginTitle}>Supapi Admin</div>
        <div className={styles.loginSub}>Enter admin password to continue</div>
        <input className={styles.loginInput} type="password" placeholder="Admin password"
          value={adminPass} onChange={e => setAdminPass(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()} />
        {loginErr && <div className={styles.loginErr}>{loginErr}</div>}
        <button className={styles.loginBtn} onClick={handleLogin}>Enter Admin →</button>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>🛡️ Supapi Admin</div>
          <div className={styles.headerSub}>Dashboard</div>
        </div>
        <div className={styles.headerRight}>
          <Link href="/" className={styles.viewSiteBtn}>View Site →</Link>
        </div>
      </div>

      {/* Nav cards */}
      <div className={styles.navGrid}>
        {[
          { href:"/admin/market",         icon:"🛍️", label:"Marketplace",  sub:"Listings · Orders · Disputes" },
          { href:"/admin/market#users",    icon:"👥", label:"Users",        sub:"Ban · Verify · Manage" },
          { href:"/admin/market#commission",icon:"💰",label:"Commission",   sub:`Current: ${commPct}%` },
        ].map(n => (
          <Link key={n.href} href={n.href} className={styles.navCard}>
            <div className={styles.navIcon}>{n.icon}</div>
            <div className={styles.navLabel}>{n.label}</div>
            <div className={styles.navSub}>{n.sub}</div>
          </Link>
        ))}
      </div>

      {loading ? (
        <div className={styles.loadingState}>Loading analytics...</div>
      ) : (
        <div className={styles.body}>
          {/* Stats */}
          {stats && (
            <div className={styles.statsGrid}>
              {[
                { label:"Active Listings",  val: stats.listings.active,    color:"#F5A623" },
                { label:"Total Orders",     val: stats.orders.total,       color:"#fff" },
                { label:"Completed Sales",  val: stats.orders.completed,   color:"#27ae60" },
                { label:"Open Disputes",    val: stats.orders.disputed,    color: stats.orders.disputed > 0 ? "#e74c3c" : "#27ae60" },
                { label:"Total GMV",        val: `${stats.revenue.total_pi.toFixed(2)} π`,          color:"#F5A623" },
                { label:"Est. Commission",  val: `${stats.revenue.estimated_commission.toFixed(3)} π`, color:"#2980b9" },
              ].map(s => (
                <div key={s.label} className={styles.statCard}>
                  <div className={styles.statVal} style={{ color: s.color }}>{s.val}</div>
                  <div className={styles.statLbl}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Charts */}
          {analytics && (
            <>
              {/* Orders over time */}
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <div className={styles.chartTitle}>📦 Orders — Last 30 Days</div>
                  <div className={styles.chartLegend}>
                    <span style={{color:"#F5A623"}}>■ Orders</span>
                    <span style={{color:"#27ae60"}}>■ Completed</span>
                  </div>
                </div>
                <div className={styles.dualBar}>
                  {analytics.days.map((d, i) => {
                    const maxO = Math.max(...analytics.days.map(x => x.orders), 1);
                    return (
                      <div key={i} className={styles.dualCol}>
                        <div className={styles.dualWrap}>
                          <div className={styles.dualBarBg} style={{ height:`${(d.orders/maxO)*100}%`, background:"rgba(245,166,35,0.3)" }} />
                          <div className={styles.dualBarFg} style={{ height:`${(d.completed/maxO)*100}%`, background:"#27ae60" }} />
                        </div>
                        {i % 7 === 0 && <div className={styles.barLabel}>{fmtDate(d.date)}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Revenue over time */}
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <div className={styles.chartTitle}>💰 Revenue — Last 30 Days (π)</div>
                </div>
                <BarChart data={analytics.days} valueKey="revenue" labelKey="date" color="#F5A623" />
              </div>

              <div className={styles.twoCol}>
                {/* Category breakdown */}
                <div className={styles.chartCard}>
                  <div className={styles.chartTitle}>🗂️ Listings by Category</div>
                  <div className={styles.catList}>
                    {analytics.categories.map((c, i) => {
                      const max = analytics.categories[0]?.count ?? 1;
                      return (
                        <div key={i} className={styles.catRow}>
                          <div className={styles.catName}>{CAT_EMOJI[c.name] ?? "📦"} {c.name}</div>
                          <div className={styles.catBarWrap}>
                            <div className={styles.catBar} style={{ width:`${(c.count/max)*100}%` }} />
                          </div>
                          <div className={styles.catCount}>{c.count}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top sellers */}
                <div className={styles.chartCard}>
                  <div className={styles.chartTitle}>🏆 Top Sellers</div>
                  <div className={styles.sellerList}>
                    {analytics.top_sellers.map((s, i) => (
                      <Link key={s.seller_id} href={`/admin/users/${s.seller_id}`} className={styles.sellerRow}>
                        <div className={styles.sellerRank}>{i + 1}</div>
                        <div className={styles.sellerAvatar}>
                          {s.info?.avatar_url
                            ? <img src={s.info.avatar_url} alt="" className={styles.sellerAvatarImg} />
                            : <span>{getInitial(s.info?.username ?? "?")}</span>
                          }
                        </div>
                        <div className={styles.sellerInfo}>
                          <div className={styles.sellerName}>{s.info?.display_name ?? s.info?.username}</div>
                          <div className={styles.sellerSub}>{s.count} sales</div>
                        </div>
                        <div className={styles.sellerRevenue}>{s.total.toFixed(2)} π</div>
                      </Link>
                    ))}
                    {analytics.top_sellers.length === 0 && <div className={styles.empty}>No sales yet</div>}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Export */}
          <div className={styles.exportCard}>
            <div className={styles.exportTitle}>📥 Export Data</div>
            <div className={styles.exportBtns}>
              {["orders","listings","commissions"].map(t => (
                <button key={t} className={styles.exportBtn} disabled={exporting === t} onClick={() => exportCSV(t)}>
                  {exporting === t ? "Exporting..." : `Export ${t.charAt(0).toUpperCase() + t.slice(1)} CSV`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}