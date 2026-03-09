"use client";

// app/admin/analytics/page.tsx

import { useEffect, useState } from "react";
import "@/styles/admin.css";
import styles from "./page.module.css";

interface Analytics {
  overview: {
    totalUsers: number; newUsersToday: number; newUsersMonth: number;
    totalListings: number; activeListings: number;
    totalOrders: number; disputedOrders: number;
    gmv30d: number; platformRevenue30d: number;
  };
  categoryBreakdown: { name: string; count: number }[];
}

export default function AnalyticsPage() {
  const [data,    setData]    = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then((d) => { if (d.success) setData(d.data); })
      .finally(() => setLoading(false));
  }, []);

  const o = data?.overview;

  return (
    <div>
      <div className="pageHeader">
        <div>
          <h1 className="pageTitle">Analytics</h1>
          <p className="pageSub">Platform performance metrics</p>
        </div>
      </div>

      {loading || !o ? (
        <div className="loading">Loading analytics...</div>
      ) : (
        <>
          {/* Revenue block */}
          <div className={styles.revenueBlock}>
            <div className={styles.revenueItem}>
              <div className={styles.revenueLabel}>GMV (30 days)</div>
              <div className={styles.revenueValue}>π {o.gmv30d.toLocaleString()}</div>
              <div className={styles.revenueSub}>Gross merchandise value</div>
            </div>
            <div className={styles.revenueDivider} />
            <div className={styles.revenueItem}>
              <div className={styles.revenueLabel}>Platform Revenue (30d)</div>
              <div className={`${styles.revenueValue} ${styles.green}`}>π {o.platformRevenue30d.toFixed(2)}</div>
              <div className={styles.revenueSub}>5% commission fees</div>
            </div>
          </div>

          {/* User stats */}
          <h2 className={styles.section}>Users</h2>
          <div className="statGrid">
            {[
              { label: "Total Users",      value: o.totalUsers.toLocaleString(),     color: "statBlue"  },
              { label: "New Today",        value: o.newUsersToday.toLocaleString(),   color: "statGreen" },
              { label: "New This Month",   value: o.newUsersMonth.toLocaleString(),   color: "statGold"  },
            ].map((s) => (
              <div key={s.label} className="statCard">
                <div className="statLabel">{s.label}</div>
                <div className={`statValue ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Platform stats */}
          <h2 className={styles.section}>Platform</h2>
          <div className="statGrid">
            {[
              { label: "Total Listings",   value: o.totalListings.toLocaleString(),   color: "statGold"  },
              { label: "Active Listings",  value: o.activeListings.toLocaleString(),  color: "statGreen" },
              { label: "Total Orders",     value: o.totalOrders.toLocaleString(),     color: "statBlue"  },
              { label: "Disputed Orders",  value: o.disputedOrders.toLocaleString(),  color: "statRed"   },
            ].map((s) => (
              <div key={s.label} className="statCard">
                <div className="statLabel">{s.label}</div>
                <div className={`statValue ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Category breakdown */}
          {data?.categoryBreakdown?.length ? (
            <>
              <h2 className={styles.section}>Listings by Category</h2>
              <div className={styles.catTable}>
                {data.categoryBreakdown.map((c, i) => (
                  <div key={c.name} className={styles.catRow}>
                    <span className={styles.catRank}>#{i + 1}</span>
                    <span className={styles.catName}>{c.name}</span>
                    <div className={styles.catBar}>
                      <div
                        className={styles.catFill}
                        style={{ width: `${(c.count / (data.categoryBreakdown[0]?.count || 1)) * 100}%` }}
                      />
                    </div>
                    <span className={styles.catCount}>{c.count} listings</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
