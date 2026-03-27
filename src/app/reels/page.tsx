"use client";
export const dynamic = "force-dynamic";

import { useAuth } from "@/components/providers/AuthProvider";
import { useState, useEffect } from "react";
import Link from "next/link";
import heroStyles from "@/styles/feed-hero.module.css";
import styles from "./page.module.css";
import ReelCardActions from "@/components/feed/ReelCardActions";

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
  is_liked?: boolean;
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

  useEffect(() => {
    const onVisible = () => { if (user && document.visibilityState === "visible") fetchFeed(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user?.id]);

  return (
    <div className={heroStyles.page}>
      <div className={heroStyles.header}>
        <div className={heroStyles.heroBg} aria-hidden />
        <div className={heroStyles.headerInner}>
          <div className={heroStyles.headerTop}>
            <div className={heroStyles.titleRow}>
              <h1 className={heroStyles.title}>Reels</h1>
              {user && (
                <button
                  type="button"
                  className={`${heroStyles.refreshBtn} ${loading ? heroStyles.refreshBtnLoading : ""}`}
                  onClick={() => fetchFeed()}
                  disabled={loading}
                  aria-label="Refresh feed"
                >
                  <span className={heroStyles.refreshIcon} aria-hidden>↻</span>
                  <span className={heroStyles.refreshLabel}>Refresh</span>
                </button>
              )}
            </div>
            <p className={heroStyles.headerSub}>Short videos from pioneers you follow</p>
          </div>
        </div>
      </div>

      <div className={heroStyles.body}>
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
                        @{r.user?.username ?? "?"}
                      </Link>
                      <span className={styles.statusTime}>
                        {new Date(r.created_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                  </div>
                  <div className={styles.reelVideoWrap}>
                    <video
                      src={r.video_url}
                      controls
                      playsInline
                      preload="metadata"
                      className={styles.reelVideo}
                      onPlay={(e) => {
                        const v = e.currentTarget;
                        if (v.dataset.viewed) return;
                        v.dataset.viewed = "1";
                        // Update count locally — no full page refetch
                        fetch(`/api/reels/${r.id}/view`, { method: "POST" })
                          .then((res) => res.json())
                          .then((d) => {
                            if (d?.data?.view_count != null) {
                              setFeed((prev) =>
                                prev.map((x) =>
                                  x.id === r.id ? { ...x, view_count: d.data.view_count } : x
                                )
                              );
                            } else {
                              // Fallback: increment locally
                              setFeed((prev) =>
                                prev.map((x) =>
                                  x.id === r.id ? { ...x, view_count: x.view_count + 1 } : x
                                )
                              );
                            }
                          })
                          .catch(() => {});
                      }}
                    />
                  </div>
                  {r.caption && <div className={styles.statusBody}>{r.caption}</div>}
                  <div className={styles.reelStats}>
                    <span>👁 {r.view_count} views</span>
                  </div>
                  {user && (
                    <ReelCardActions
                      reelId={r.id}
                      isOwner={r.user_id === user.id}
                      likeCount={r.like_count}
                      commentCount={r.comment_count}
                      isLiked={r.is_liked ?? false}
                      caption={r.caption}
                      onLike={() => setFeed((prev) => prev.map((x) => x.id === r.id ? { ...x, is_liked: true, like_count: x.like_count + 1 } : x))}
                      onUnlike={() => setFeed((prev) => prev.map((x) => x.id === r.id ? { ...x, is_liked: false, like_count: Math.max(0, x.like_count - 1) } : x))}
                      onDelete={() => setFeed((prev) => prev.filter((x) => x.id !== r.id))}
                      onEditCaption={(c) => setFeed((prev) => prev.map((x) => x.id === r.id ? { ...x, caption: c || null } : x))}
                      onRefresh={fetchFeed}
                      token={token}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
