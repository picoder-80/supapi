"use client";
export const dynamic = "force-dynamic";

import { useAuth } from "@/components/providers/AuthProvider";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "./page.module.css";

const QUICK_ACTIONS = [
  { href: "/market",   emoji: "🛍️", label: "Market"   },
  { href: "/wallet",   emoji: "💰", label: "Wallet"   },
  { href: "/referral", emoji: "🤝", label: "Referral" },
  { href: "/rewards",  emoji: "🎁", label: "Rewards"  },
];

const PLATFORMS = [
  { href: "/market",      emoji: "🛍️", label: "Marketplace" },
  { href: "/gigs",        emoji: "💼", label: "Gigs"        },
  { href: "/academy",     emoji: "📚", label: "Academy"     },
  { href: "/stay",        emoji: "🏡", label: "Stay"        },
  { href: "/arcade",      emoji: "🎮", label: "Arcade"      },
  { href: "/community",   emoji: "👥", label: "Community"   },
  { href: "/wallet",      emoji: "💰", label: "Wallet"      },
  { href: "/referral",    emoji: "🤝", label: "Referral"    },
  { href: "/locator",     emoji: "📍", label: "Locator"     },
  { href: "/jobs",        emoji: "🧑‍💻", label: "Jobs"        },
  { href: "/rewards",     emoji: "🎁", label: "Rewards"     },
  { href: "/content",     emoji: "🎬", label: "Content"     },
  { href: "/pi-value",    emoji: "📈", label: "Pi Value"    },
  { href: "/classifieds", emoji: "📋", label: "Classifieds" },
  { href: "/myspace",     emoji: "🪐", label: "MySpace"     },
];

const TX_ICONS: Record<string, string> = {
  sale:              "💰",
  purchase:          "🛍️",
  referral_reward:   "🤝",
  game_reward:       "🎮",
  course_enrollment: "📚",
  stay_booking:      "🏡",
  escrow_release:    "🔓",
  platform_fee:      "⚙️",
};

const TX_LABELS: Record<string, string> = {
  sale:              "Sale earnings",
  purchase:          "Purchase",
  referral_reward:   "Referral reward",
  game_reward:       "Game reward",
  course_enrollment: "Course enrolled",
  stay_booking:      "Stay booking",
  escrow_release:    "Escrow released",
  platform_fee:      "Platform fee",
};

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Stats {
  orders: number;
  referrals: number;
  earned: string;
  transactions: Array<{
    id: string;
    type: string;
    amount_pi: number;
    memo: string;
    status: string;
    created_at: string;
  }>;
}

export default function DashboardPage() {
  const { user, isHydrating, login, isLoading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const fetchStats = useCallback(async () => {
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    setLoadingStats(true);
    try {
      const r = await fetch("/api/dashboard/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.success) setStats(d.data);
    } catch {}
    setLoadingStats(false);
  }, []);

  useEffect(() => {
    if (user) fetchStats();
  }, [user, fetchStats]);

  if (isHydrating) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1A1A2E,#0F3460)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Loading...</span>
    </div>
  );

  if (!user) return (
    <div className={styles.guestPage}>
      <div className={styles.guestIcon}>🪐</div>
      <h1 className={styles.guestTitle}>Your Pi Dashboard</h1>
      <p className={styles.guestSub}>Login with your Pi account to access all 15 platforms.</p>
      <button className={styles.guestBtn} onClick={() => login()} disabled={isLoading}>
        {isLoading ? "Connecting..." : "π  Sign in with Pi"}
      </button>
    </div>
  );

  const isAdmin = user.role === "admin";
  const txList  = stats?.transactions ?? [];

  return (
    <div>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <div className={styles.greeting}>{getGreeting()},</div>
            <div className={styles.username}>
              <span className={styles.usernamePi}>π</span> {user.username}
            </div>
          </div>
          <Link href="/myspace" className={styles.avatar}>{getInitial(user.username)}</Link>
        </div>

        <div className={styles.statRow}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>
              {loadingStats ? "..." : `${stats?.earned ?? "0.00"}π`}
            </div>
            <div className={styles.statLabel}>Supapi Earnings</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{loadingStats ? "..." : (stats?.orders ?? 0)}</div>
            <div className={styles.statLabel}>Orders</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{loadingStats ? "..." : (stats?.referrals ?? 0)}</div>
            <div className={styles.statLabel}>Referrals</div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className={styles.body}>

        {/* Admin shortcut */}
        {isAdmin && (
          <Link href="/admin/dashboard" className={styles.adminBanner}>
            <div className={styles.adminBannerLeft}>
              <span className={styles.adminBannerIcon}>⚙️</span>
              <div>
                <div className={styles.adminBannerTitle}>Admin Dashboard</div>
                <div className={styles.adminBannerSub}>Manage users, listings & analytics</div>
              </div>
            </div>
            <span className={styles.adminBannerArrow}>→</span>
          </Link>
        )}

        {/* Profile Card */}
        <div className={styles.section}>
          <div className={styles.profileCard}>
            <div className={styles.profileAvatar}>{getInitial(user.username)}</div>
            <div className={styles.profileInfo}>
              <div className={styles.profileName}>{user.display_name ?? user.username}</div>
              <div className={styles.profilePiId}>@{user.username}</div>
              <div className={styles.profileBadges}>
                <span className={styles.badge}>🪐 Pioneer</span>
                {user.kyc_status === "verified" && <span className={styles.badge}>✅ KYC</span>}
                {isAdmin && <span className={`${styles.badge} ${styles.badgeAdmin}`}>⚙️ Admin</span>}
              </div>
            </div>
            <Link href="/myspace" className={styles.profileEdit}>✏️</Link>
          </div>
        </div>

        {/* Quick Actions */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Quick Access</div>
          </div>
          <div className={styles.quickGrid}>
            {QUICK_ACTIONS.map((item) => (
              <Link key={item.href} href={item.href} className={styles.quickItem}>
                <span className={styles.quickEmoji}>{item.emoji}</span>
                <span className={styles.quickLabel}>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Transaction History */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Transaction History</div>
            <Link href="/wallet" className={styles.sectionLink}>See all →</Link>
          </div>

          {loadingStats ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>⏳</div>
              Loading...
            </div>
          ) : txList.length > 0 ? (
            <div className={styles.activityList}>
              {txList.map((tx) => {
                const isEarning = ["sale", "referral_reward", "game_reward", "escrow_release"].includes(tx.type);
                return (
                  <div key={tx.id} className={styles.activityItem}>
                    <div className={styles.activityIcon}>{TX_ICONS[tx.type] ?? "💳"}</div>
                    <div className={styles.activityInfo}>
                      <div className={styles.activityTitle}>
                        {tx.memo || TX_LABELS[tx.type] || tx.type}
                      </div>
                      <div className={styles.activitySub}>
                        {timeAgo(tx.created_at)}
                        {tx.status !== "completed" && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: "var(--color-text-muted)", background: "var(--color-bg)", padding: "1px 6px", borderRadius: 6 }}>
                            {tx.status}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`${styles.activityAmount} ${!isEarning ? styles.activityAmountNeg : ""}`}>
                      {isEarning ? "+" : "-"}{Number(tx.amount_pi).toFixed(2)}π
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📋</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No transactions yet</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                Your Supapi earnings and purchases will appear here
              </div>
            </div>
          )}
        </div>

        {/* All Platforms */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>All Platforms</div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>15 services</span>
          </div>
          <div className={styles.platformsGrid}>
            {PLATFORMS.map((item) => (
              <Link key={item.href} href={item.href} className={styles.platformCard}>
                <span className={styles.platformEmoji}>{item.emoji}</span>
                <span className={styles.platformLabel}>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}