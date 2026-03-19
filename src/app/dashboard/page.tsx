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

/** Fields used to compute profile completeness (same weights as before). */
interface ProfileCompletenessSource {
  display_name: string;
  phone: string;
  email: string;
  address_line1: string;
  city: string;
  postcode: string;
  country: string;
  wallet_address: string;
}

const EMPTY_PROFILE_FIELDS: ProfileCompletenessSource = {
  display_name:  "",
  phone:         "",
  email:         "",
  address_line1: "",
  city:          "",
  postcode:      "",
  country:       "",
  wallet_address: "",
};

const COMPLETENESS_FIELDS: (keyof ProfileCompletenessSource)[] = [
  "display_name",
  "phone",
  "email",
  "address_line1",
  "city",
  "postcode",
  "country",
  "wallet_address",
];

function computeProfileCompletePct(profile: ProfileCompletenessSource): number {
  const filled = COMPLETENESS_FIELDS.filter((f) => String(profile[f] ?? "").trim()).length;
  return Math.round((filled / COMPLETENESS_FIELDS.length) * 100);
}

export default function DashboardPage() {
  const { user, isHydrating, login, isLoading } = useAuth();
  const [profileFields, setProfileFields] = useState<ProfileCompletenessSource>(EMPTY_PROFILE_FIELDS);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "");

  const fetchProfileForCompleteness = useCallback(async () => {
    if (!token()) return;
    setLoadingProfile(true);
    try {
      const r = await fetch("/api/dashboard/profile", { headers: { Authorization: `Bearer ${token()}` } });
      const d = await r.json();
      if (d.success && d.data) {
        setProfileFields({ ...EMPTY_PROFILE_FIELDS, ...d.data });
      }
    } catch {
      setProfileFields(EMPTY_PROFILE_FIELDS);
    }
    setLoadingProfile(false);
  }, []);

  useEffect(() => {
    if (user) fetchProfileForCompleteness();
  }, [user, fetchProfileForCompleteness]);

  if (isHydrating)
    return (
      <div
        style={{
          minHeight:      "100vh",
          background:     "linear-gradient(135deg,#1A1A2E,#0F3460)",
          display:        "flex",
          alignItems:     "center",
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
  const pct = computeProfileCompletePct(profileFields);
  const complete = pct === 100;

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

        <div className={styles.heroCompleteness}>
          <div className={styles.heroCompletenessTitle}>Profile completeness</div>
          <div className={styles.heroCompletenessTop}>
            <span className={styles.heroCompletenessLabel}>Your profile</span>
            <span
              className={`${styles.heroCompletenessPct} ${complete ? styles.heroCompletenessPctDone : ""}`}
            >
              {loadingProfile ? "…" : `${pct}%`}
            </span>
          </div>
          {loadingProfile ? (
            <div className={styles.heroCompletenessSkeleton} />
          ) : (
            <div className={styles.heroCompletenessBar}>
              <div
                className={`${styles.heroCompletenessFill} ${complete ? styles.heroCompletenessFillDone : ""}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          {!loadingProfile && !complete && (
            <p className={styles.heroCompletenessHint}>
              Complete your profile for faster checkout, buyer trust, and SC rewards (when available) on MySpace.
            </p>
          )}
          {!loadingProfile && complete && (
            <p className={styles.heroCompletenessHint} style={{ color: "rgba(110,231,168,0.9)" }}>
              Profile complete — you can still update details on MySpace anytime.
            </p>
          )}
          <Link href={`/supaspace/${user.username}`} className={styles.heroCompletenessLink}>
            {complete ? "View MySpace →" : "Complete profile →"}
          </Link>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>SupaMarket selling</div>
            <Link href="/supamarket/seller" className={styles.sectionLink}>
              Seller Hub →
            </Link>
          </div>
          <Link
            href="/supamarket/seller"
            className={styles.whatsNextCard}
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
          >
            <div className={styles.whatsNextIcon}>🏪</div>
            <div className={styles.whatsNextText}>
              <strong>Seller Hub</strong> — listing overview, open orders, and shortcuts to My Listings, selling
              orders, and earnings.
            </div>
            <span className={styles.whatsNextBtn} style={{ pointerEvents: "none" }}>
              Open →
            </span>
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

        {!user.wallet_address?.trim() && (
          <div className={styles.section}>
            <div className={styles.whatsNextCard} style={{ borderColor: "rgba(245,166,35,0.5)" }}>
              <div className={styles.whatsNextIcon}>π</div>
              <div className={styles.whatsNextText}>
                Add your <strong>Pi wallet address</strong> to receive payments, tips, and escrow payouts. Edit on
                MySpace or sign in with Pi again after you activate your wallet.
              </div>
              <Link href={`/supaspace/${user.username}`} className={styles.whatsNextBtn}>
                Open MySpace →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
