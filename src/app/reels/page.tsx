"use client";
export const dynamic = "force-dynamic";

import { useAuth } from "@/components/providers/AuthProvider";
import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./page.module.css";

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }

interface Pioneer {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  kyc_status: string;
  bio: string | null;
}

interface FeedData {
  following: Pioneer[];
  popular: Pioneer[];
}

export default function ReelsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"following" | "popular">("popular");
  const [feed, setFeed] = useState<FeedData>({ following: [], popular: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      setLoading(true);
      try {
        const uid = user?.id ?? "";
        const r = await fetch(`/api/newsfeed${uid ? `?userId=${uid}` : ""}`);
        const d = await r.json();
        if (d.success) setFeed(d.data);
      } catch {}
      setLoading(false);
    };
    fetch_();
  }, [user?.id]);

  const list = tab === "following" ? feed.following : feed.popular;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>🎬 Reels</h1>
          <div className={styles.headerSub}>Short videos from Pi pioneers</div>
        </div>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === "following" ? styles.tabActive : ""}`} onClick={() => setTab("following")}>
            👥 Following
          </button>
          <button className={`${styles.tab} ${tab === "popular" ? styles.tabActive : ""}`} onClick={() => setTab("popular")}>
            🔥 Popular
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {/* Coming soon banner */}
        <div className={styles.comingSoonBanner}>
          <div className={styles.comingSoonIcon}>🎬</div>
          <div>
            <div className={styles.comingSoonTitle}>Video reels coming soon</div>
            <div className={styles.comingSoonDesc}>Short videos from pioneers you follow — sorted by likes & shares. For now, explore pioneer profiles below.</div>
          </div>
        </div>

        {/* Placeholder reel cards */}
        <div className={styles.reelPlaceholders}>
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className={styles.reelPlaceholder}>
              <div className={styles.reelThumb}>
                <div className={styles.reelPlayIcon}>▶</div>
              </div>
              <div className={styles.reelInfo}>
                <div className={styles.reelTitle} style={{ width: `${50 + i * 8}%` }} />
                <div className={styles.reelMeta} style={{ width: "40%" }} />
              </div>
            </div>
          ))}
        </div>

        {/* Pioneer discovery */}
        <div className={styles.discoverSection}>
          <div className={styles.discoverTitle}>
            {tab === "following" ? "👥 Pioneers You Follow" : "🔥 Popular Pioneers"}
          </div>
          <div className={styles.tabs2}>
            <button className={`${styles.tab2} ${tab === "following" ? styles.tab2Active : ""}`} onClick={() => setTab("following")}>Following</button>
            <button className={`${styles.tab2} ${tab === "popular" ? styles.tab2Active : ""}`} onClick={() => setTab("popular")}>Popular</button>
          </div>

          {tab === "following" && !user ? (
            <div className={styles.loginPrompt}>
              <div className={styles.loginIcon}>🪐</div>
              <div className={styles.loginTitle}>Sign in to see pioneers you follow</div>
              <Link href="/dashboard" className={styles.loginBtn}>Sign In with Pi →</Link>
            </div>
          ) : loading ? (
            <div className={styles.empty}><div className={styles.emptyIcon}>⏳</div><div>Loading...</div></div>
          ) : list.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>👥</div>
              <div className={styles.emptyTitle}>No pioneers yet</div>
              <button className={styles.emptyBtn} onClick={() => setTab("popular")}>See Popular →</button>
            </div>
          ) : (
            <div className={styles.pioneerList}>
              {list.map((p) => (
                <Link key={p.id} href={`/myspace/${p.username}`} className={styles.pioneerRow}>
                  <div className={styles.avatar}>
                    {p.avatar_url
                      ? <img src={p.avatar_url} alt={p.username} className={styles.avatarImg} />
                      : <span className={styles.avatarInitial}>{getInitial(p.username)}</span>
                    }
                  </div>
                  <div className={styles.pioneerInfo}>
                    <div className={styles.displayName}>
                      {p.display_name ?? p.username}
                      {p.kyc_status === "verified" && <span className={styles.kycBadge}>✅</span>}
                    </div>
                    <div className={styles.username}>@{p.username}</div>
                  </div>
                  <div className={styles.viewProfile}>View →</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}