"use client";
export const dynamic = "force-dynamic";

import { useAuth } from "@/components/providers/AuthProvider";
import Link from "next/link";
import { isAdminRole } from "@/lib/admin/roles";
import { useState, useEffect, useCallback } from "react";
import styles from "./page.module.css";

function getInitial(u: string) {
  return u?.charAt(0).toUpperCase() ?? "?";
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

interface DashboardStats {
  orders: number;
  referrals: number;
  earned: string;
  transactions: Array<{
    id: string;
    type: string;
    amount_pi: number | string | null;
    memo: string | null;
    status: string | null;
    created_at: string;
  }>;
  sc_balance: number;
  listings: number;
  gigs: number;
  recent_orders: Array<{
    id: string;
    status: string;
    amount_pi: number;
    created_at: string;
    listing?: { title?: string | null } | null;
  }>;
  credit_transactions: Array<{
    id: string;
    type: string;
    amount: number;
    activity: string;
    note: string | null;
    created_at: string;
  }>;
  pets: number;
}

function fmtPi(n: number) {
  return `${Number(n).toFixed(2)} π`;
}

export default function DashboardPage() {
  const { user, isHydrating, login, isLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const token = () =>
    (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "");

  const fetchStats = useCallback(async () => {
    const t = token();
    if (!t) return;
    setLoadingStats(true);
    try {
      const r = await fetch("/api/dashboard/stats", {
        headers: { Authorization: `Bearer ${t}` },
      });
      const d = await r.json();
      if (d?.success && d?.data) setStats(d.data as DashboardStats);
      else setStats(null);
    } catch {
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchStats();
  }, [user, fetchStats]);

  if (isHydrating)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg,#1A1A2E,#0F3460)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Loading...</span>
      </div>
    );

  if (!user)
    return (
      <div className={styles.guestPage}>
        <div className={styles.guestIcon}>🪐</div>
        <h1 className={styles.guestTitle}>Your Pi Dashboard</h1>
        <p className={styles.guestSub}>Login with your Pi account to access all 15 platforms.</p>
        <button className={styles.guestBtn} onClick={() => login()} disabled={isLoading}>
          {isLoading ? "Connecting..." : "π  Sign in with Pi"}
        </button>
      </div>
    );

  const isAdmin = isAdminRole(user.role);
  const walletMissing = !user.wallet_address?.trim();

  const earnedPi = stats ? Number(stats.earned ?? 0) : 0;

  return (
    <div>
      <div className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <div className={styles.greeting}>{getGreeting()},</div>
            <div className={styles.username}>
              <span className={styles.usernamePi}>π</span> {user.username}
            </div>
          </div>
          <Link href={`/supaspace/${user.username}`} className={styles.avatar}>
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.username}
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
              />
            ) : (
              getInitial(user.username)
            )}
          </Link>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Overview</div>
            <Link href="/wallet" className={styles.sectionLink}>
              Wallet →
            </Link>
          </div>

          <div className={styles.infoCards}>
            <div className={styles.infoCard}>
              <div className={styles.infoCardIcon}>📦</div>
              <div className={styles.infoCardInfo}>
                <div className={styles.infoCardLabel}>Orders</div>
                <div className={styles.infoCardValue}>{loadingStats ? "…" : stats?.orders ?? 0}</div>
              </div>
            </div>
            <div className={styles.infoCard}>
              <div className={styles.infoCardIcon}>🛍️</div>
              <div className={styles.infoCardInfo}>
                <div className={styles.infoCardLabel}>Listings</div>
                <div className={styles.infoCardValue}>{loadingStats ? "…" : stats?.listings ?? 0}</div>
              </div>
            </div>
            <div className={styles.infoCard}>
              <div className={styles.infoCardIcon}>💎</div>
              <div className={styles.infoCardInfo}>
                <div className={styles.infoCardLabel}>Earnings</div>
                <div className={styles.infoCardValue}>
                  {loadingStats ? "…" : fmtPi(earnedPi)}
                </div>
              </div>
            </div>
            <div className={styles.infoCard}>
              <div className={styles.infoCardIcon}>💳</div>
              <div className={styles.infoCardInfo}>
                <div className={styles.infoCardLabel}>SC Balance</div>
                <div className={styles.infoCardValue}>
                  {loadingStats ? "…" : `${Number(stats?.sc_balance ?? 0).toFixed(2)} SC`}
                </div>
              </div>
            </div>
          </div>
        </div>

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

        {walletMissing && (
          <div className={styles.section}>
            <div className={styles.whatsNextCard} style={{ borderColor: "rgba(245,166,35,0.5)" }}>
              <div className={styles.whatsNextIcon}>π</div>
              <div className={styles.whatsNextText}>
                Add your <strong>Pi wallet address</strong> so payments, tips, and escrow payouts can reach you.
                Edit from <strong>MySpace</strong>.
              </div>
              <Link href={`/supaspace/${user.username}`} className={styles.whatsNextBtn}>
                Open MySpace →
              </Link>
            </div>
          </div>
        )}

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Quick Actions</div>
            <Link href="/rewards" className={styles.sectionLink}>
              Rewards →
            </Link>
          </div>

          <div className={styles.quickGrid}>
            <Link href="/supamarket/seller" className={styles.quickItem}>
              <div className={styles.quickEmoji}>🏪</div>
              <div className={styles.quickLabel}>SupaMarket Seller Hub</div>
            </Link>
            <Link href="/supamarket/my-listings" className={styles.quickItem}>
              <div className={styles.quickEmoji}>🛍️</div>
              <div className={styles.quickLabel}>My Market Listings</div>
            </Link>
            <Link href="/supasifieds/my-listings" className={styles.quickItem}>
              <div className={styles.quickEmoji}>📋</div>
              <div className={styles.quickLabel}>My Classified Ads</div>
            </Link>
            <Link href="/returns-refunds" className={styles.quickItem}>
              <div className={styles.quickEmoji}>↩️</div>
              <div className={styles.quickLabel}>Returns & Refunds</div>
            </Link>
            <Link href="/wallet" className={styles.quickItem}>
              <div className={styles.quickEmoji}>💰</div>
              <div className={styles.quickLabel}>Pi Wallet</div>
            </Link>
            <Link href="/supachat" className={styles.quickItem}>
              <div className={styles.quickEmoji}>💬</div>
              <div className={styles.quickLabel}>SupaChat</div>
            </Link>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Recent Activity</div>
            <Link href="/supamarket/orders" className={styles.sectionLink}>
              Orders →
            </Link>
          </div>

          {loadingStats ? (
            <div className={styles.empty}>Loading your activity…</div>
          ) : (
            <>
              <div className={styles.profileCard} style={{ marginBottom: 10 }}>
                <div className={styles.profileAvatar} style={{ width: 52, height: 52, fontSize: 20 }}>
                  🧾
                </div>
                <div className={styles.profileInfo}>
                  <div className={styles.profileName}>Recent Orders</div>
                  <div className={styles.profilePiId}>Latest marketplace activity</div>
                </div>
              </div>

              {(stats?.recent_orders ?? []).slice(0, 6).length ? (
                (stats?.recent_orders ?? []).slice(0, 6).map((o) => (
                  <div key={o.id} className={styles.profileSection} style={{ cursor: "default" }}>
                    <div className={styles.profileSectionIcon}>📦</div>
                    <div className={styles.profileSectionInfo}>
                      <div className={styles.profileSectionTitle}>
                        {o.id.slice(0, 8)}… · {o.listing?.title ?? "—"}
                      </div>
                      <div className={styles.profileSectionDesc}>
                        Amount: {Number(o.amount_pi ?? 0).toFixed(2)} π
                      </div>
                      <div className={styles.profileSectionStatus}>
                        <span className={o.status === "completed" ? styles.statusDone : styles.statusPending}>
                          {o.status}
                        </span>
                      </div>
                    </div>
                    <div className={styles.profileSectionArrow}>→</div>
                  </div>
                ))
              ) : (
                <div className={styles.empty}>No recent orders yet.</div>
              )}

              <div className={styles.profileCard} style={{ marginTop: 16 }}>
                <div className={styles.profileAvatar} style={{ width: 52, height: 52, fontSize: 20 }}>
                  💳
                </div>
                <div className={styles.profileInfo}>
                  <div className={styles.profileName}>Recent SC Activity</div>
                  <div className={styles.profilePiId}>Latest credit transactions</div>
                </div>
              </div>

              {(stats?.credit_transactions ?? []).slice(0, 6).length ? (
                (stats?.credit_transactions ?? []).slice(0, 6).map((t) => (
                  <div key={t.id} className={styles.profileSection} style={{ cursor: "default" }}>
                    <div className={styles.profileSectionIcon}>🔁</div>
                    <div className={styles.profileSectionInfo}>
                      <div className={styles.profileSectionTitle}>{t.activity}</div>
                      <div className={styles.profileSectionDesc}>
                        {Number(t.amount).toFixed(2)} SC · {t.type}
                      </div>
                      <div className={styles.profileSectionStatus}>
                        <span className={t.amount >= 0 ? styles.statusDone : styles.statusPending}>
                          {t.amount >= 0 ? "Earn" : "Spend"}
                        </span>
                      </div>
                    </div>
                    <div className={styles.profileSectionArrow}>→</div>
                  </div>
                ))
              ) : (
                <div className={styles.empty}>No recent SC transactions yet.</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
