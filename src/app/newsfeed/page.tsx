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

export default function NewsfeedPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"following" | "popular">("following");
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

  useEffect(() => {
    if (user) setTab("following");
    else setTab("popular");
  }, [user]);

  const list = tab === "following" ? feed.following : feed.popular;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>📰 Newsfeed</h1>
          <div className={styles.headerSub}>Posts & updates from pioneers</div>
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

      {/* Content */}
      <div className={styles.body}>
        {/* Coming soon banner */}
        <div className={styles.comingSoonBanner}>
          <div className={styles.comingSoonIcon}>✍️</div>
          <div>
            <div className={styles.comingSoonTitle}>Post feed coming soon</div>
            <div className={styles.comingSoonDesc}>Text posts, images & links from pioneers you follow will appear here. For now, discover and follow pioneers below.</div>
          </div>
        </div>

        {/* Not logged in */}
        {tab === "following" && !user ? (
          <div className={styles.loginPrompt}>
            <div className={styles.loginIcon}>🪐</div>
            <div className={styles.loginTitle}>Sign in to see your feed</div>
            <div className={styles.loginSub}>Follow pioneers to see their posts here</div>
            <Link href="/dashboard" className={styles.loginBtn}>Sign In with Pi →</Link>
          </div>
        ) : tab === "following" && user && list.length === 0 && !loading ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>👥</div>
            <div className={styles.emptyTitle}>Not following anyone yet</div>
            <div className={styles.emptyDesc}>Discover pioneers below and follow them to build your feed</div>
            <button className={styles.emptyBtn} onClick={() => setTab("popular")}>Discover Popular Pioneers →</button>
          </div>
        ) : loading ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>⏳</div>
            <div className={styles.emptyTitle}>Loading feed...</div>
          </div>
        ) : list.length > 0 ? (
          <div className={styles.pioneerGrid}>
            {list.map((p) => (
              <Link key={p.id} href={`/myspace/${p.username}`} className={styles.pioneerCard}>
                <div className={styles.cardTop}>
                  <div className={styles.avatar}>
                    {p.avatar_url
                      ? <img src={p.avatar_url} alt={p.username} className={styles.avatarImg} />
                      : <span className={styles.avatarInitial}>{getInitial(p.username)}</span>
                    }
                  </div>
                  <div className={styles.userInfo}>
                    <div className={styles.displayName}>
                      {p.display_name ?? p.username}
                      {p.kyc_status === "verified" && <span className={styles.kycBadge}>✅</span>}
                    </div>
                    <div className={styles.username}>@{p.username}</div>
                  </div>
                </div>
                {p.bio && <div className={styles.bio}>{p.bio}</div>}
                <div className={styles.cardFooter}>
                  <span className={styles.pioneerTag}>🪐 Pioneer</span>
                  <span className={styles.viewBtn}>View Profile →</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📰</div>
            <div className={styles.emptyTitle}>No pioneers found</div>
          </div>
        )}
      </div>
    </div>
  );
}