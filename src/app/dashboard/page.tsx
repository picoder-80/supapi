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
  purchase_orders?: number;
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
  pets: number;
  profile_reward_claimed?: boolean;
}

interface ProfileSnapshot {
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  wallet_address?: string | null;
  address_line1?: string | null;
  city?: string | null;
  postcode?: string | null;
  country?: string | null;
}

function fmtPi(n: number) {
  return `${Number(n).toFixed(2)} π`;
}

export default function DashboardPage() {
  const { user, isHydrating, login, isLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [profileSnapshot, setProfileSnapshot] = useState<ProfileSnapshot | null>(null);
  const [claimingProfileReward, setClaimingProfileReward] = useState(false);
  const [profileRewardMsg, setProfileRewardMsg] = useState("");

  const token = () =>
    (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "");

  const fetchStats = useCallback(async () => {
    const t = token();
    if (!t) return;
    setLoadingStats(true);
    try {
      const r = await fetch("/api/dashboard/stats", {
        cache: "no-store",
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

  useEffect(() => {
    const t = token();
    if (!t || !user) return;
    fetch("/api/dashboard/profile", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${t}` },
    })
      .then((r) => r.json())
      .then((d) => setProfileSnapshot(d?.success ? (d.data as ProfileSnapshot) : null))
      .catch(() => setProfileSnapshot(null));
  }, [user]);

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
  const profileDisplayName = profileSnapshot?.display_name ?? user.display_name;
  const profileBio = profileSnapshot?.bio ?? user.bio;
  const profileAvatar = profileSnapshot?.avatar_url ?? user.avatar_url;
  const profileWallet = profileSnapshot?.wallet_address ?? user.wallet_address;
  const hasShippingAddress = Boolean(
    profileSnapshot?.address_line1?.trim() &&
    profileSnapshot?.city?.trim() &&
    profileSnapshot?.postcode?.trim() &&
    profileSnapshot?.country?.trim()
  );
  const profileChecks = [
    { label: "Add display name", done: Boolean(profileDisplayName?.trim()), href: `/supaspace/${user.username}` },
    { label: "Add bio", done: Boolean(profileBio?.trim()), href: `/supaspace/${user.username}` },
    { label: "Add profile photo", done: Boolean(profileAvatar?.trim()), href: `/supaspace/${user.username}` },
    { label: "Add Pi wallet address", done: Boolean(profileWallet?.trim()), href: `/supaspace/${user.username}` },
    { label: "Add shipping address", done: hasShippingAddress, href: `/supaspace/${user.username}` },
  ];
  const doneCount = profileChecks.filter((c) => c.done).length;
  const completenessPct = Math.round((doneCount / profileChecks.length) * 100);
  const canClaimProfileReward = completenessPct === 100 && !stats?.profile_reward_claimed;

  const claimProfileReward = async () => {
    const t = token();
    if (!t || claimingProfileReward || !canClaimProfileReward) return;
    setClaimingProfileReward(true);
    setProfileRewardMsg("");
    try {
      const r = await fetch("/api/credits/earn", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ activity: "complete_profile" }),
      });
      const d = await r.json();
      if (d?.success) {
        setProfileRewardMsg(d?.data?.message ?? "Profile reward claimed");
      } else {
        setProfileRewardMsg(d?.error ?? "Unable to claim reward");
      }
      await fetchStats();
    } catch {
      setProfileRewardMsg("Unable to claim reward");
    } finally {
      setClaimingProfileReward(false);
    }
  };

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

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Overview</div>
          </div>

          <div className={styles.infoCards}>
            <Link href="/wallet" className={styles.infoCardLink}>
              <div className={styles.infoCard}>
                <div className={styles.infoCardIcon}>💰</div>
                <div className={styles.infoCardInfo}>
                  <div className={styles.infoCardLabel}>My Wallet</div>
                  <div className={styles.infoCardValue}>Open →</div>
                </div>
              </div>
            </Link>
            <Link href="/dashboard/purchases" className={styles.infoCardLink}>
              <div className={styles.infoCard}>
                <div className={styles.infoCardIcon}>📦</div>
                <div className={styles.infoCardInfo}>
                  <div className={styles.infoCardLabel}>Order Purchase</div>
                  <div className={styles.infoCardValue}>{loadingStats ? "…" : stats?.purchase_orders ?? 0}</div>
                </div>
              </div>
            </Link>
            <Link href="/referral" className={styles.infoCardLink}>
              <div className={styles.infoCard}>
                <div className={styles.infoCardIcon}>🤝</div>
                <div className={styles.infoCardInfo}>
                  <div className={styles.infoCardLabel}>Referral</div>
                  <div className={styles.infoCardValue}>
                    {loadingStats ? "…" : stats?.referrals ?? 0}
                  </div>
                </div>
              </div>
            </Link>
            <Link href={`/supaspace/${user.username}/pets`} className={styles.infoCardLink}>
              <div className={styles.infoCard}>
                <div className={styles.infoCardIcon}>🐾</div>
                <div className={styles.infoCardInfo}>
                  <div className={styles.infoCardLabel}>My Pets</div>
                  <div className={styles.infoCardValue}>
                    {loadingStats ? "…" : stats?.pets ?? 0}
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Profile Completeness</div>
          </div>
          <div className={styles.completenessCard}>
            <div className={styles.completenessTop}>
              <div className={styles.completenessLabel}>
                {doneCount}/{profileChecks.length} completed
              </div>
              <div className={styles.completenessPct}>{completenessPct}%</div>
            </div>
            <div className={styles.completenessBar}>
              <span style={{ width: `${completenessPct}%` }} />
            </div>
            <div className={styles.completenessSteps}>
              {profileChecks.map((step) => (
                <Link key={step.label} href={step.href} className={styles.completenessStep}>
                  <span className={step.done ? styles.stepDone : styles.stepPending}>
                    {step.done ? "✓" : "○"}
                  </span>
                  <span>{step.label}</span>
                </Link>
              ))}
            </div>
            <div className={styles.completenessRewardRow}>
              {canClaimProfileReward ? (
                <button className={styles.completenessClaimBtn} onClick={claimProfileReward} disabled={claimingProfileReward}>
                  {claimingProfileReward ? "Claiming..." : "Claim 100 SC"}
                </button>
              ) : stats?.profile_reward_claimed ? (
                <div className={styles.completenessClaimed}>Reward claimed</div>
              ) : (
                <div className={styles.completenessHint}>Complete all steps to unlock 100 SC.</div>
              )}
            </div>
            {profileRewardMsg && <div className={styles.completenessHint}>{profileRewardMsg}</div>}
          </div>
        </div>

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
      </div>
    </div>
  );
}
