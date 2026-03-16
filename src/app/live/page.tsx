"use client";
export const dynamic = "force-dynamic";

import { useAuth } from "@/components/providers/AuthProvider";
import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./page.module.css";

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }

interface LiveSession {
  id: string;
  user_id: string;
  title: string | null;
  stream_url: string | null;
  status: string;
  viewer_count: number;
  started_at: string;
  user?: { username: string; display_name: string | null; avatar_url: string | null };
}

export default function LivePage() {
  const { user } = useAuth();
  const [feed, setFeed] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "");

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/live", {
        headers: user ? { Authorization: `Bearer ${token()}` } : {},
      });
      const d = await r.json();
      if (d.success && d.data?.sessions) setFeed(d.data.sessions);
      else setFeed([]);
    } catch { setFeed([]); }
    setLoading(false);
  };

  useEffect(() => {
    fetchFeed();
  }, [user?.id]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>🔴 Live</h1>
          <div className={styles.headerSub}>Live streams from pioneers you follow</div>
        </div>
      </div>

      <div className={styles.body}>
        {user ? (
          <div className={styles.createBox}>
            <div className={styles.createRow}>
              <div className={styles.createAvatar}>
                {user.avatar_url ? <img src={user.avatar_url} alt="" /> : getInitial(user.username)}
              </div>
              <Link href="/live/go" className={styles.createInput}>
                Go live and connect with your followers...
              </Link>
            </div>
            <div className={styles.createActions}>
              <Link href="/live/go" className={styles.postBtn}>Go Live</Link>
            </div>
          </div>
        ) : (
          <div className={styles.loginPrompt}>
            <div className={styles.loginIcon}>🪐</div>
            <div className={styles.loginTitle}>Sign in to go live</div>
            <div className={styles.loginSub}>Start a live stream and connect with pioneers who follow you</div>
            <Link href="/dashboard" className={styles.loginBtn}>Sign In with Pi →</Link>
          </div>
        )}

        <div className={styles.feedSection}>
          <div className={styles.feedTitle}>Live Feed</div>
          {loading ? (
            <div className={styles.empty}><div className={styles.emptyIcon}>⏳</div><div>Loading...</div></div>
          ) : feed.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🔴</div>
              <div className={styles.emptyTitle}>No one is live</div>
              <div className={styles.emptyDesc}>
                {user ? "Be the first to go live! Or discover more pioneers in SupaFeeds." : "Sign in to see live streams from pioneers you follow."}
              </div>
              {user && <Link href="/live/go" className={styles.emptyBtn}>Go Live →</Link>}
            </div>
          ) : (
            <div className={styles.feedList}>
              {feed.map((s) => (
                <Link key={s.id} href={`/live/${s.id}`} className={styles.statusCard}>
                  <div className={styles.statusHeader}>
                    <div className={styles.statusAvatar}>
                      {s.user?.avatar_url ? <img src={s.user.avatar_url} alt="" /> : getInitial(s.user?.username ?? "?")}
                    </div>
                    <div className={styles.statusMeta}>
                      <span className={styles.statusName}>
                        {s.user?.display_name ?? s.user?.username ?? "?"}
                      </span>
                      <span className={styles.statusTime}>
                        {new Date(s.started_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                  </div>
                  <div className={styles.liveVideoWrap}>
                    <div className={styles.livePlaceholder} />
                    <span className={styles.liveBadge}>● LIVE</span>
                    <span className={styles.liveViewerCount}>👁 {s.viewer_count}</span>
                  </div>
                  {s.title && <div className={styles.statusBody}>{s.title}</div>}
                  <div className={styles.reelStats}>
                    <span>👁 {s.viewer_count} watching</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
