"use client";
export const dynamic = "force-dynamic";

import { useAuth } from "@/components/providers/AuthProvider";
import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./page.module.css";

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }

interface StatusPost {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
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
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>📰 Newsfeed</h1>
          <div className={styles.headerSub}>Status updates from pioneers you follow</div>
        </div>
      </div>

      <div className={styles.body}>
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
                        {p.user?.display_name ?? p.user?.username ?? "?"}
                      </Link>
                      <span className={styles.statusTime}>
                        {new Date(p.created_at).toLocaleDateString(undefined, { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                  </div>
                  <div className={styles.statusBody}>{p.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
