"use client";
export const dynamic = "force-dynamic";

import { useAuth } from "@/components/providers/AuthProvider";
import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./page.module.css";

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }

interface ReelItem {
  id: string;
  user_id: string;
  video_url: string;
  caption: string | null;
  like_count: number;
  view_count: number;
  comment_count: number;
  created_at: string;
  user?: { username: string; display_name: string | null; avatar_url: string | null };
}

export default function ReelsPage() {
  const { user } = useAuth();
  const [feed, setFeed] = useState<ReelItem[]>([]);
  const [loading, setLoading] = useState(true);

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "");

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/reels", {
        headers: user ? { Authorization: `Bearer ${token()}` } : {},
      });
      const d = await r.json();
      if (d.success && d.data?.reels) setFeed(d.data.reels);
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
          <h1 className={styles.title}>🎬 Reels</h1>
          <div className={styles.headerSub}>Short videos from pioneers you follow</div>
        </div>
      </div>

      <div className={styles.body}>
        {user ? (
          <div className={styles.createBox}>
            <div className={styles.createRow}>
              <div className={styles.createAvatar}>
                {user.avatar_url ? <img src={user.avatar_url} alt="" /> : getInitial(user.username)}
              </div>
              <Link href="/reels/create" className={styles.createInput}>
                Share a short video...
              </Link>
            </div>
            <div className={styles.createActions}>
              <Link href="/reels/create" className={styles.postBtn}>Upload Reel</Link>
            </div>
          </div>
        ) : (
          <div className={styles.loginPrompt}>
            <div className={styles.loginIcon}>🪐</div>
            <div className={styles.loginTitle}>Sign in to upload reels</div>
            <div className={styles.loginSub}>Upload short videos and see reels from pioneers you follow</div>
            <Link href="/dashboard" className={styles.loginBtn}>Sign In with Pi →</Link>
          </div>
        )}

        <div className={styles.feedSection}>
          <div className={styles.feedTitle}>Reels Feed</div>
          {loading ? (
            <div className={styles.empty}><div className={styles.emptyIcon}>⏳</div><div>Loading...</div></div>
          ) : feed.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🎬</div>
              <div className={styles.emptyTitle}>No reels yet</div>
              <div className={styles.emptyDesc}>
                {user ? "Be the first to upload a reel! Or discover more pioneers in SupaFeeds." : "Sign in to see reels from pioneers you follow."}
              </div>
              {user && <Link href="/reels/create" className={styles.emptyBtn}>Upload Reel →</Link>}
            </div>
          ) : (
            <div className={styles.feedList}>
              {feed.map((r) => (
                <div key={r.id} className={styles.statusCard}>
                  <div className={styles.statusHeader}>
                    <Link href={`/supaspace/${r.user?.username ?? ""}`} className={styles.statusAvatar}>
                      {r.user?.avatar_url ? <img src={r.user.avatar_url} alt="" /> : getInitial(r.user?.username ?? "?")}
                    </Link>
                    <div className={styles.statusMeta}>
                      <Link href={`/supaspace/${r.user?.username ?? ""}`} className={styles.statusName}>
                        {r.user?.display_name ?? r.user?.username ?? "?"}
                      </Link>
                      <span className={styles.statusTime}>
                        {new Date(r.created_at).toLocaleDateString(undefined, { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                  </div>
                  <div className={styles.reelVideoWrap}>
                    <video
                      src={r.video_url}
                      controls
                      playsInline
                      className={styles.reelVideo}
                    />
                  </div>
                  {r.caption && <div className={styles.statusBody}>{r.caption}</div>}
                  <div className={styles.reelStats}>
                    <span>❤️ {r.like_count}</span>
                    <span>👁 {r.view_count}</span>
                    <span>💬 {r.comment_count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
