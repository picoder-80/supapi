"use client";

// app/admin/dashboard/page.tsx

import { useEffect, useState } from "react";
import Link from "next/link";
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

const PLATFORMS = [
  { href: "/market",      emoji: "🛍️", label: "Marketplace"  },
  { href: "/gigs",        emoji: "💼", label: "Gigs"          },
  { href: "/academy",     emoji: "📚", label: "Academy"       },
  { href: "/stay",        emoji: "🏡", label: "Stay"          },
  { href: "/arcade",      emoji: "🎮", label: "Arcade"        },
  { href: "/community",   emoji: "👥", label: "Community"     },
  { href: "/wallet",      emoji: "💰", label: "Wallet"        },
  { href: "/referral",    emoji: "🤝", label: "Referral"      },
  { href: "/locator",     emoji: "📍", label: "Locator"       },
  { href: "/jobs",        emoji: "🧑‍💻", label: "Jobs"          },
  { href: "/rewards",     emoji: "🎁", label: "Rewards"       },
  { href: "/content",     emoji: "🎬", label: "Content"       },
  { href: "/pi-value",    emoji: "📈", label: "Pi Value"      },
  { href: "/classifieds", emoji: "📋", label: "Classifieds"   },
  { href: "/myspace",     emoji: "🪐", label: "MySpace"       },
];

const ADMIN_TOOLS = [
  { href: "/admin/users",     icon: "👥", label: "Users",     sub: "Manage all users"        },
  { href: "/admin/listings",  icon: "🛍️", label: "Listings",  sub: "Review & moderate"       },
  { href: "/admin/orders",    icon: "📦", label: "Orders",    sub: "Transactions & disputes" },
  { href: "/admin/analytics", icon: "📊", label: "Analytics", sub: "Full platform stats"     },
];

export default function AdminDashboardPage() {
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
    { label: "Total Users",     value: o.totalUsers.toLocaleString(),         sub: `+${o.newUsersToday} today`   },
    { label: "This Month",      value: o.newUsersMonth.toLocaleString(),       sub: "new users"                   },
    { label: "Active Listings", value: o.activeListings.toLocaleString(),      sub: `of ${o.totalListings} total` },
    { label: "Orders",          value: o.totalOrders.toLocaleString(),         sub: `${o.disputedOrders} disputed`},
    { label: "GMV (30d)",       value: `π ${o.gmv30d.toLocaleString()}`,       sub: "gross merchandise value"     },
    { label: "Revenue (30d)",   value: `π ${o.platformRevenue30d.toFixed(2)}`, sub: "platform fees"               },
  ] : [];

  return (
    <div>
      {/* Header */}
      <div className="pageHeader">
        <div>
          <h1 className="pageTitle">Admin Dashboard</h1>
          <p className="pageSub">Full control across all 15 platforms</p>
        </div>
        <div className={styles.liveTag}>● LIVE</div>
      </div>

      {/* Shortcut to User Dashboard */}
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

      {/* Stats */}
      {loading ? (
        <div className="loading">Loading analytics...</div>
      ) : (
        <div className="statGrid">
          {stats.map((s) => (
            <div key={s.label} className="statCard">
              <div className="statLabel">{s.label}</div>
              <div className="statValue statGold">{s.value}</div>
              <div className="statSub">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Admin Tools */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Admin Tools</h2>
        <div className={styles.quickGrid}>
          {ADMIN_TOOLS.map((t) => (
            <Link key={t.href} href={t.href} className={styles.quickCard}>
              <span className={styles.quickIcon}>{t.icon}</span>
              <div>
                <div className={styles.quickLabel}>{t.label}</div>
                <div className={styles.quickSub}>{t.sub}</div>
              </div>
              <span className={styles.quickArrow}>→</span>
            </Link>
          ))}
        </div>
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
                    style={{ width: `${Math.max(4, (c.count / (data.categoryBreakdown[0]?.count || 1)) * 100)}%` }}
                  />
                </div>
                <span className={styles.catCount}>{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* All 15 Platforms */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>All 15 Platforms</h2>
        <div className={styles.platformGrid}>
          {PLATFORMS.map((p) => (
            <Link key={p.href} href={p.href} className={styles.platformCard}>
              <span className={styles.platformEmoji}>{p.emoji}</span>
              <span className={styles.platformLabel}>{p.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}