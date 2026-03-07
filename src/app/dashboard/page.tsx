"use client";

export const dynamic = "force-dynamic";

// app/dashboard/page.tsx
// Pi User Dashboard — cross all 15 platforms + admin shortcut

import { useAuth } from "@/components/providers/AuthProvider";
import Link from "next/link";
import styles from "./page.module.css";

const QUICK_ACTIONS = [
  { href: "/market",     emoji: "🛍️", label: "Market"    },
  { href: "/wallet",     emoji: "💰", label: "Wallet"    },
  { href: "/referral",   emoji: "🤝", label: "Referral"  },
  { href: "/rewards",    emoji: "🎁", label: "Rewards"   },
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
  { href: "/classifieds",  emoji: "📋", label: "Classifieds" },
  { href: "/myspace",     emoji: "🪐", label: "MySpace"     },
];

// Mock recent activity — replace with real data later
const MOCK_ACTIVITY = [
  { icon: "🛍️", title: "Sold: iPhone 13 Case",       sub: "2 hours ago",    amount: "+2.5π",  neg: false },
  { icon: "🎁", title: "Daily Reward Claimed",        sub: "Today 8:00 AM",  amount: "+0.1π",  neg: false },
  { icon: "🤝", title: "Referral Bonus — @ahmad123",  sub: "Yesterday",      amount: "+0.5π",  neg: false },
  { icon: "💼", title: "Gig Payment — Logo Design",   sub: "2 days ago",     amount: "+5π",    neg: false },
];

function getInitial(username: string) {
  return username?.charAt(0).toUpperCase() ?? "?";
}

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { user, isHydrating, login, isLoading } = useAuth();

  // Loading state
  if (isHydrating) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1A1A2E,#0F3460)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Loading...</span>
      </div>
    );
  }

  // Guest — not logged in
  if (!user) {
    return (
      <div className={styles.guestPage}>
        <div className={styles.guestIcon}>🪐</div>
        <h1 className={styles.guestTitle}>Your Pi Dashboard</h1>
        <p className={styles.guestSub}>
          Login with your Pi account to access all 15 platforms with one identity.
        </p>
        <button
          className={styles.guestBtn}
          onClick={() => login()}
          disabled={isLoading}
        >
          {isLoading ? "Connecting..." : "π  Sign in with Pi"}
        </button>
      </div>
    );
  }

  const isAdmin = user.role === "admin";

  return (
    <div>
      {/* ── Hero ── */}
      <div className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <div className={styles.greeting}>{getTimeGreeting()},</div>
            <div className={styles.username}>
              <span className={styles.usernamePi}>π</span> {user.username}
            </div>
          </div>
          <Link href="/myspace" className={styles.avatar}>
            {getInitial(user.username)}
          </Link>
        </div>

        <div className={styles.statRow}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>0.0π</div>
            <div className={styles.statLabel}>Balance</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>0</div>
            <div className={styles.statLabel}>Orders</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>0</div>
            <div className={styles.statLabel}>Referrals</div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>

        {/* Admin shortcut — only show if admin */}
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

        {/* Recent Activity */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Recent Activity</div>
            <Link href="/wallet" className={styles.sectionLink}>See all →</Link>
          </div>
          <div className={styles.activityList}>
            {MOCK_ACTIVITY.length > 0 ? MOCK_ACTIVITY.map((item, i) => (
              <div key={i} className={styles.activityItem}>
                <div className={styles.activityIcon}>{item.icon}</div>
                <div className={styles.activityInfo}>
                  <div className={styles.activityTitle}>{item.title}</div>
                  <div className={styles.activitySub}>{item.sub}</div>
                </div>
                <div className={`${styles.activityAmount} ${item.neg ? styles.activityAmountNeg : ""}`}>
                  {item.amount}
                </div>
              </div>
            )) : (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>💰</div>
                No activity yet
              </div>
            )}
          </div>
        </div>

        {/* All 15 Platforms */}
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