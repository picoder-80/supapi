"use client";
export const dynamic = "force-dynamic";

import { useAuth } from "@/components/providers/AuthProvider";
import { useState, useEffect } from "react";
import Link from "next/link";
import heroStyles from "@/styles/feed-hero.module.css";
import styles from "./page.module.css";
import StatusCardActions from "@/components/feed/StatusCardActions";

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }

interface StatusPost {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  like_count?: number;
  comment_count?: number;
  is_liked?: boolean;
  user?: { username: string; display_name: string | null; avatar_url: string | null };
}

export default function NewsfeedPage() {
  const { user } = useAuth();
  const [statusText, setStatusText] = useState("");
  const [posting, setPosting] = useState(false);
  const [feed, setFeed] = useState<StatusPost[]>([]);
  const [loading, setLoading] = useState(true);

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "");

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/newsfeed/status", {
        headers: user ? { Authorization: `Bearer ${token()}` } : {},
      });
      const d = await r.json();
      if (d.success && d.data?.posts) setFeed(d.data.posts);
      else setFeed([]);
    } catch { setFeed([]); }
    setLoading(false);
  };

  useEffect(() => {
    fetchFeed();
  }, [user?.id]);

  // Refresh when user returns to tab (e.g. from SupaSpace or another tab)
  useEffect(() => {
    const onVisible = () => { if (user && document.visibilityState === "visible") fetchFeed(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user?.id]);

  const handlePost = async () => {
    const text = statusText.trim();
    if (!text || !user || !token()) return;
    setPosting(true);
    try {
      const r = await fetch("/api/newsfeed/status", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ body: text }),
      });
      const d = await r.json();
      if (d.success) {
        setStatusText("");
        fetchFeed();
      } else alert(d.error ?? "Failed to post");
    } catch { alert("Failed to post"); }
    setPosting(false);
  };

  return (
    <div className={heroStyles.page}>
      <div className={heroStyles.header}>
        <div className={heroStyles.heroBg} aria-hidden />
        <div className={heroStyles.headerInner}>
          <div className={heroStyles.headerTop}>
            <div className={heroStyles.titleRow}>
              <h1 className={heroStyles.title}>Newsfeed</h1>
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
            <p className={heroStyles.headerSub}>Status updates from pioneers you follow</p>
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
              <textarea
                className={styles.createInput}
                placeholder="What's on your mind?"
                value={statusText}
                onChange={e => setStatusText(e.target.value)}
                maxLength={500}
                rows={2}
              />
            </div>
            <div className={styles.createActions}>
              <span className={styles.charCount}>{statusText.length}/500</span>
              <button
                className={styles.postBtn}
                onClick={handlePost}
                disabled={posting || !statusText.trim()}
              >
                {posting ? "Posting..." : "Post Status"}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.loginPrompt}>
            <div className={styles.loginIcon}>🪐</div>
            <div className={styles.loginTitle}>Sign in to post status</div>
            <div className={styles.loginSub}>Share what's on your mind with the Pi community</div>
            <Link href="/dashboard" className={styles.loginBtn}>Sign In with Pi →</Link>
          </div>
        )}

        <div className={styles.feedSection}>
          <div className={styles.feedTitle}>Status Feed</div>
          {loading ? (
            <div className={styles.empty}><div className={styles.emptyIcon}>⏳</div><div>Loading...</div></div>
          ) : feed.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📰</div>
              <div className={styles.emptyTitle}>No status updates yet</div>
              <div className={styles.emptyDesc}>
                {user ? "Be the first to post a status! Or discover more pioneers in SupaFeeds." : "Sign in to see status updates from pioneers you follow."}
              </div>
              {user && <Link href="/supafeeds" className={styles.emptyBtn}>Discover SupaFeeds →</Link>}
            </div>
          ) : (
            <div className={styles.feedList}>
              {feed.map((p) => (
                <div key={p.id} className={styles.statusCard}>
                  <div className={styles.statusHeader}>
                    <Link href={`/supaspace/${p.user?.username ?? ""}`} className={styles.statusAvatar}>
                      {p.user?.avatar_url ? <img src={p.user.avatar_url} alt="" /> : getInitial(p.user?.username ?? "?")}
                    </Link>
                    <div className={styles.statusMeta}>
                      <Link href={`/supaspace/${p.user?.username ?? ""}`} className={styles.statusName}>
                        @{p.user?.username ?? "?"}
                      </Link>
                      <span className={styles.statusTime}>
                        {new Date(p.created_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                  </div>
                  <div className={styles.statusBody}>{p.body}</div>
                  {user && (
                    <StatusCardActions
                      postId={p.id}
                      isOwner={p.user_id === user.id}
                      likeCount={p.like_count ?? 0}
                      commentCount={p.comment_count ?? 0}
                      isLiked={p.is_liked ?? false}
                      body={p.body}
                      onLike={() => setFeed((prev) => prev.map((x) => x.id === p.id ? { ...x, is_liked: true, like_count: (x.like_count ?? 0) + 1 } : x))}
                      onUnlike={() => setFeed((prev) => prev.map((x) => x.id === p.id ? { ...x, is_liked: false, like_count: Math.max(0, (x.like_count ?? 1) - 1) } : x))}
                      onDelete={() => setFeed((prev) => prev.filter((x) => x.id !== p.id))}
                      onEdit={(newBody) => setFeed((prev) => prev.map((x) => x.id === p.id ? { ...x, body: newBody } : x))}
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
