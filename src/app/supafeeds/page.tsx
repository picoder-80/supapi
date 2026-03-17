"use client";
export const dynamic = "force-dynamic";

import { useAuth } from "@/components/providers/AuthProvider";
import { useState, useEffect } from "react";
import Link from "next/link";
import heroStyles from "@/styles/feed-hero.module.css";
import styles from "./page.module.css";
import StatusCardActions from "@/components/feed/StatusCardActions";
import ReelCardActions from "@/components/feed/ReelCardActions";

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }

type FeedItem =
  | { type: "status"; id: string; user_id: string; body: string; created_at: string; like_count?: number; comment_count?: number; is_liked?: boolean; user?: { username: string; display_name: string | null; avatar_url: string | null } }
  | { type: "reel"; id: string; user_id: string; video_url: string; caption: string | null; like_count: number; view_count: number; comment_count: number; created_at: string; is_liked?: boolean; user?: { username: string; display_name: string | null; avatar_url: string | null } }
  | { type: "live"; id: string; user_id: string; title: string | null; stream_url: string | null; viewer_count: number; started_at: string; user?: { username: string; display_name: string | null; avatar_url: string | null } };

export default function SupaFeedsPage() {
  const { user } = useAuth();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "");

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/supafeeds", {
        headers: user ? { Authorization: `Bearer ${token()}` } : {},
      });
      const d = await r.json();
      if (d.success && d.data?.feed) setFeed(d.data.feed);
      else setFeed([]);
    } catch { setFeed([]); }
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchFeed();
    else setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    const onVisible = () => { if (user && document.visibilityState === "visible") fetchFeed(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user?.id]);

  const UserHeader = ({ item }: { item: FeedItem }) => {
    const u = item.user;
    const ts = item.type === "live" ? (item as { started_at: string }).started_at : (item as { created_at: string }).created_at;
    return (
      <div className={styles.statusHeader}>
        <Link href={`/supaspace/${u?.username ?? ""}`} className={styles.statusAvatar}>
          {u?.avatar_url ? <img src={u.avatar_url} alt="" /> : getInitial(u?.username ?? "?")}
        </Link>
        <div className={styles.statusMeta}>
          <Link href={`/supaspace/${u?.username ?? ""}`} className={styles.statusName}>
            @{u?.username ?? "?"}
          </Link>
          <span className={styles.statusTime}>
            {new Date(ts).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className={heroStyles.page}>
      <div className={heroStyles.header}>
        <div className={heroStyles.heroBg} aria-hidden />
        <div className={heroStyles.headerInner}>
          <div className={heroStyles.headerTop}>
            <div className={heroStyles.titleRow}>
              <h1 className={heroStyles.title}>SupaFeeds</h1>
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
            <p className={heroStyles.headerSub}>Status, Reels & Live from pioneers you follow</p>
          </div>
        </div>
      </div>

      <div className={heroStyles.body}>
        {!user ? (
          <div className={styles.loginPrompt}>
            <div className={styles.loginIcon}>🪐</div>
            <div className={styles.loginTitle}>Sign in to see your feed</div>
            <div className={styles.loginSub}>Status, Reels & Live from pioneers you follow will appear here</div>
            <Link href="/dashboard" className={styles.loginBtn}>Sign In with Pi →</Link>
          </div>
        ) : loading ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>⏳</div>
            <div className={styles.emptyTitle}>Loading feed...</div>
          </div>
        ) : feed.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📱</div>
            <div className={styles.emptyTitle}>No posts yet</div>
            <div className={styles.emptyDesc}>Follow pioneers to see their status, reels and live streams here</div>
            <Link href="/pioneers" className={styles.emptyBtn}>Discover Pioneers →</Link>
          </div>
        ) : (
          <div className={styles.feedList}>
            {feed.map((item) => (
              <div key={`${item.type}-${item.id}`} className={styles.statusCard}>
                <UserHeader item={item} />
                {item.type === "status" && (
                  <>
                    <div className={styles.statusBody}>{item.body}</div>
                    {user && (
                      <StatusCardActions
                        postId={item.id}
                        isOwner={item.user_id === user.id}
                        likeCount={item.like_count ?? 0}
                        commentCount={item.comment_count ?? 0}
                        isLiked={item.is_liked ?? false}
                        body={item.body}
                        onLike={() => setFeed((prev) => prev.map((x) => x.type === "status" && x.id === item.id ? { ...x, is_liked: true, like_count: (x.like_count ?? 0) + 1 } : x))}
                        onUnlike={() => setFeed((prev) => prev.map((x) => x.type === "status" && x.id === item.id ? { ...x, is_liked: false, like_count: Math.max(0, (x.like_count ?? 1) - 1) } : x))}
                        onDelete={() => setFeed((prev) => prev.filter((x) => !(x.type === "status" && x.id === item.id)))}
                        onEdit={(b) => setFeed((prev) => prev.map((x) => x.type === "status" && x.id === item.id ? { ...x, body: b } : x))}
                        onRefresh={fetchFeed}
                        token={token}
                      />
                    )}
                  </>
                )}
                {item.type === "reel" && (
                  <>
                    <div className={styles.reelVideoWrap}>
                      <video
                        src={item.video_url}
                        controls
                        playsInline
                        className={styles.reelVideo}
                        onPlay={(e) => {
                          const v = e.currentTarget;
                          if (v.dataset.viewed) return;
                          v.dataset.viewed = "1";
                          fetch(`/api/reels/${item.id}/view`, { method: "POST" }).then(() => fetchFeed());
                        }}
                      />
                    </div>
                    {item.caption && <div className={styles.statusBody}>{item.caption}</div>}
                    <div className={styles.reelStats}>
                      <span>👁 {item.view_count} views</span>
                    </div>
                    {user && (
                      <ReelCardActions
                        reelId={item.id}
                        isOwner={item.user_id === user.id}
                        likeCount={item.like_count}
                        commentCount={item.comment_count}
                        isLiked={item.is_liked ?? false}
                        caption={item.caption}
                        onLike={() => setFeed((prev) => prev.map((x) => x.type === "reel" && x.id === item.id ? { ...x, is_liked: true, like_count: x.like_count + 1 } : x))}
                        onUnlike={() => setFeed((prev) => prev.map((x) => x.type === "reel" && x.id === item.id ? { ...x, is_liked: false, like_count: Math.max(0, x.like_count - 1) } : x))}
                        onDelete={() => setFeed((prev) => prev.filter((x) => !(x.type === "reel" && x.id === item.id)))}
                        onEditCaption={(c) => setFeed((prev) => prev.map((x) => x.type === "reel" && x.id === item.id ? { ...x, caption: c || null } : x))}
                        onRefresh={fetchFeed}
                        token={token}
                      />
                    )}
                  </>
                )}
                {item.type === "live" && (
                  <Link href={`/live/${item.id}`} className={styles.liveCard}>
                    <div className={styles.liveBadge}>🔴 LIVE</div>
                    <div className={styles.liveTitle}>{item.title || "Live now"}</div>
                    <div className={styles.liveViewers}>👁 {item.viewer_count} watching</div>
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
