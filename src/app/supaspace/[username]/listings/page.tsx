"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import styles from "./page.module.css";

const PLATFORMS = [
  { id: "market",     emoji: "🛍️", label: "SupaMarket",   href: (u: string) => `/supamarket?seller=${u}`,       countKey: "listings" },
  { id: "gigs",       emoji: "💼", label: "SupaSkil",     href: (u: string) => `/supaskil?seller=${u}`,          countKey: "gigs" },
  { id: "academy",    emoji: "📚", label: "SupaDemy",     href: (u: string) => `/supademy?instructor=${u}`,   countKey: "courses" },
  { id: "stay",       emoji: "🏡", label: "SupaStay",     href: (u: string) => `/supastay?host=${u}`,             countKey: "stays" },
  { id: "jobs",       emoji: "🧑‍💻", label: "SupaHiro",     href: (u: string) => `/supamarket?category=software-digital&seller=${u}`, countKey: "jobs" },
  { id: "classifieds",emoji: "📋", label: "Supasifieds",  href: (u: string) => `/supasifieds?seller=${u}`, countKey: "classifieds" },
  { id: "bulk",       emoji: "📦", label: "SupaBulk",     href: (u: string) => `/supabulk?seller=${u}`,        countKey: "bulk" },
  { id: "machina",    emoji: "🚗", label: "SupaAuto",     href: (u: string) => `/supaauto?seller=${u}`, countKey: "machina" },
  { id: "domus",      emoji: "🏠", label: "SupaDomus",    href: (u: string) => `/supadomus?seller=${u}`,          countKey: "domus" },
  { id: "endoro",     emoji: "🛞", label: "SupaEndoro",   href: (u: string) => `/supaendoro?host=${u}`,           countKey: "endoro" },
];

export default function ListingsOverviewPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const [profile, setProfile] = useState<{ display_name: string | null } | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const f = async () => {
      setLoading(true);
      try {
        const [userRes, statsRes] = await Promise.all([
          fetch(`/api/users/${username}`),
          fetch(`/api/supaspace/stats/${username}`),
        ]);
        const userData = await userRes.json();
        const statsData = await statsRes.json();
        if (userData.success) setProfile(userData.data.user);
        if (statsData.success) setStats(statsData.data);
      } catch {}
      setLoading(false);
    };
    f();
  }, [username]);

  const name = profile?.display_name ?? username;
  const total = (stats.listings ?? 0) + (stats.gigs ?? 0) + (stats.courses ?? 0) + (stats.stays ?? 0)
    + (stats.jobs ?? 0) + (stats.classifieds ?? 0) + (stats.bulk ?? 0) + (stats.machina ?? 0) + (stats.domus ?? 0) + (stats.endoro ?? 0);

  if (loading) return <div className={styles.loading}>Loading...</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href={`/supaspace/${username}`} className={styles.backBtn}>← Back</Link>
        <h1 className={styles.title}>Listings by @{username}</h1>
        <p className={styles.sub}>{total} total across platforms</p>
      </div>

      <div className={styles.grid}>
        {PLATFORMS.map((p) => {
          const count = Number(stats[p.countKey] ?? 0);
          return (
            <Link
              key={p.id}
              href={p.href(username)}
              className={styles.card}
            >
              <span className={styles.cardEmoji}>{p.emoji}</span>
              <span className={styles.cardLabel}>{p.label}</span>
              <span className={styles.cardCount}>{count}</span>
              <span className={styles.cardLink}>View →</span>
            </Link>
          );
        })}
      </div>

      {total === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📦</div>
          <div className={styles.emptyTitle}>No listings yet</div>
          <div className={styles.emptyDesc}>@{username} has not created any listings on Supapi platforms.</div>
        </div>
      )}
    </div>
  );
}
