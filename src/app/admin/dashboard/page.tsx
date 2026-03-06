"use client";

// app/admin/dashboard/page.tsx

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import "@/styles/admin.css";

interface Analytics {
  overview: {
    totalUsers: number; newUsersToday: number; newUsersMonth: number;
    totalListings: number; activeListings: number;
    totalOrders: number; disputedOrders: number;
    gmv30d: number; platformRevenue30d: number;
  };
  categoryBreakdown: { name: string; count: number }[];
}

export default function DashboardPage() {
  const [data,    setData]    = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then((d) => { if (d.success) setData(d.data); })
      .finally(() => setLoading(false));
  }, []);

  const o = data?.overview;

  const stats = o ? [
    { label: "Total Users",       value: o.totalUsers.toLocaleString(),      color: "statBlue",  sub: `+${o.newUsersToday} today` },
    { label: "New This Month",    value: o.newUsersMonth.toLocaleString(),    color: "statGreen", sub: "registered users"          },
    { label: "Active Listings",   value: o.activeListings.toLocaleString(),   color: "statGold",  sub: `of ${o.totalListings} total` },
    { label: "Total Orders",      value: o.totalOrders.toLocaleString(),      color: "statBlue",  sub: `${o.disputedOrders} disputed` },
    { label: "GMV (30d)",         value: `π ${o.gmv30d.toLocaleString()}`,    color: "statGold",  sub: "gross merchandise value"   },
    { label: "Revenue (30d)",     value: `π ${o.platformRevenue30d.toFixed(2)}`, color: "statGreen", sub: "platform fees collected" },
  ] : [];

  return (
    <div>
      <div className="pageHeader">
        <div>
          <h1 className="pageTitle">Dashboard</h1>
          <p className="pageSub">Platform overview — last 30 days</p>
        </div>
        <div className={styles.liveTag}>● LIVE</div>
      </div>

      {loading ? (
        <div className="loading">Loading analytics...</div>
      ) : (
        <>
          {/* Stats */}
          <div className="statGrid">
            {stats.map((s) => (
              <div key={s.label} className="statCard">
                <div className="statLabel">{s.label}</div>
                <div className={`statValue ${s.color}`}>{s.value}</div>
                <div className="statSub">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Category breakdown */}
          {data?.categoryBreakdown?.length ? (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Listings by Category</h2>
              <div className={styles.catGrid}>
                {data.categoryBreakdown.map((c) => (
                  <div key={c.name} className={styles.catRow}>
                    <span className={styles.catName}>{c.name}</span>
                    <div className={styles.catBar}>
                      <div
                        className={styles.catFill}
                        style={{
                          width: `${Math.max(4, (c.count / (data.categoryBreakdown[0]?.count || 1)) * 100)}%`
                        }}
                      />
                    </div>
                    <span className={styles.catCount}>{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Quick links */}
          <div className={styles.quickGrid}>
            {[
              { href: "/admin/users",    icon: "👥", label: "Manage Users",    color: "#3B82F6" },
              { href: "/admin/listings", icon: "🛍️", label: "Review Listings", color: "#F5A623" },
              { href: "/admin/orders",   icon: "📦", label: "View Orders",     color: "#2ECC71" },
            ].map((q) => (
              <a key={q.href} href={q.href} className={styles.quickCard} style={{ borderColor: `${q.color}22` }}>
                <span className={styles.quickIcon}>{q.icon}</span>
                <span className={styles.quickLabel}>{q.label}</span>
                <span className={styles.quickArrow}>→</span>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
