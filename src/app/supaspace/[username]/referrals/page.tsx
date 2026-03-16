"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "../../page.module.css";

export default function ReferralsDetailPage() {
  const params = useParams();
  const username = params.username as string;
  const { user } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const isOwnProfile = !!user && user.username === username;

  useEffect(() => {
    fetch(`/api/supaspace/stats/${encodeURIComponent(username)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCount(d.data?.referrals ?? 0);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [username]);

  if (notFound) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>👤</div>
          <div className={styles.emptyTitle}>User not found</div>
          <Link href="/myspace" className={styles.emptyBtn}>Back to SupaSpace</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.followListHeader}>
        <Link href={`/myspace/${username}`} className={styles.followListBack}>← Profile</Link>
        <h1 className={styles.followListTitle}>Referrals</h1>
        <p className={styles.followListSub}>
          {loading ? "..." : `${count ?? 0} ${(count ?? 0) === 1 ? "referral" : "referrals"}`}
        </p>
      </div>
      <div className={styles.body}>
        {loading ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>⏳</div>
            <div className={styles.emptyTitle}>Loading...</div>
          </div>
        ) : (count ?? 0) === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🤝</div>
            <div className={styles.emptyTitle}>
              {isOwnProfile ? "No referrals yet" : `@${username} has no referrals yet`}
            </div>
            <div className={styles.emptyDesc}>
              {isOwnProfile
                ? "Share your referral link to invite friends and earn rewards when they join and use Supapi."
                : `@${username} has not referred anyone yet.`}
            </div>
            {isOwnProfile && (
              <Link href="/referral" className={styles.emptyBtn}>Go to Referral Dashboard →</Link>
            )}
            {!isOwnProfile && (
              <Link href={`/myspace/${username}`} className={styles.emptyBtn}>Back to Profile</Link>
            )}
          </div>
        ) : (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🤝</div>
            <div className={styles.emptyTitle}>{count} referral{(count ?? 0) === 1 ? "" : "s"}</div>
            <div className={styles.emptyDesc}>
              {isOwnProfile
                ? "View your full referral team, earnings and leaderboard on the Referral Dashboard."
                : `@${username} has referred ${count} pioneer${(count ?? 0) === 1 ? "" : "s"}.`}
            </div>
            {isOwnProfile && (
              <Link href="/referral" className={styles.emptyBtn}>View Referral Dashboard →</Link>
            )}
            {!isOwnProfile && (
              <Link href={`/myspace/${username}`} className={styles.emptyBtn}>Back to Profile</Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
