"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import BuyCreditsWidget from "@/components/BuyCreditsWidget";
import LiveGiftPanel from "@/components/feed/LiveGiftPanel";
import LiveCardActions from "@/components/feed/LiveCardActions";
import styles from "./page.module.css";

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }

export default function WatchLivePage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const [session, setSession] = useState<{
    id: string;
    user_id: string;
    title: string | null;
    stream_url: string | null;
    status?: string;
    viewer_count: number;
    like_count?: number;
    comment_count?: number;
    is_liked?: boolean;
    user?: { username: string; display_name: string | null; avatar_url: string | null };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchSession = () => {
    if (!id) return;
    fetch(`/api/live/${id}`, {
      headers: user ? { Authorization: `Bearer ${token()}` } : {},
    })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) setSession(d.data);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true));
  };

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/live/${id}`, {
      headers: user ? { Authorization: `Bearer ${token()}` } : {},
    })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) setSession(d.data);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id, user?.id]);

  useEffect(() => {
    if (!id || !session || session.status !== "live") return;
    fetch(`/api/live/${id}/view`, { method: "POST" })
      .then(r => r.json())
      .then(d => { if (d.success && d.data?.viewer_count != null) setSession(s => s ? { ...s, viewer_count: d.data.viewer_count } : s); })
      .catch(() => {});
  }, [id, session?.id]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (notFound || !session) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🔴</div>
          <div className={styles.emptyTitle}>Live stream not found</div>
          <Link href="/live" className={styles.emptyBtn}>Back to Live</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/live" className={styles.backBtn}>← Back</Link>
        <h1 className={styles.title}>🔴 Live</h1>
      </div>

      <div className={styles.body}>
        <div className={styles.liveCard}>
          <div className={styles.liveVideoWrap}>
            {session.stream_url ? (
              <video
                src={session.stream_url}
                autoPlay
                playsInline
                muted
                controls
                className={styles.liveVideo}
              />
            ) : (
              <div className={styles.livePlaceholder} />
            )}
            {session.status === "live" && <span className={styles.liveBadge}>● LIVE</span>}
            <span className={styles.liveViewerCount}>👁 {session.viewer_count} watching</span>
            {session.like_count !== undefined && (
              <span className={styles.liveLikeCount}>❤️ {session.like_count}</span>
            )}
            <div className={styles.liveHostBar}>
              <span className={styles.liveHostAvatar}>
                {session.user?.avatar_url ? <img src={session.user.avatar_url} alt="" /> : getInitial(session.user?.username ?? "?")}
              </span>
              <Link href={`/supaspace/${session.user?.username ?? ""}`} className={styles.liveHostName}>
                @{session.user?.username ?? "?"}
              </Link>
            </div>
          </div>
          {session.title && <div className={styles.liveTitle}>{session.title}</div>}
        </div>
        {user && session.user_id === user.id && session.status === "live" && (
          <div className={styles.endLiveWrap}>
            <button
              type="button"
              className={styles.endLiveBtn}
              onClick={() => {
                fetch(`/api/live/${session.id}`, {
                  method: "PATCH",
                  headers: { Authorization: `Bearer ${token()}` },
                })
                  .then(r => r.json())
                  .then(d => { if (d.success) setSession(s => s ? { ...s, status: "ended" } : s); });
              }}
            >
              End Live
            </button>
          </div>
        )}
        {user && (
          <div style={{ padding: "0 16px" }}>
            <LiveCardActions
              sessionId={session.id}
              isEnded={session.status === "ended"}
              likeCount={session.like_count ?? 0}
              commentCount={session.comment_count ?? 0}
              isLiked={session.is_liked ?? false}
              onLike={() => setSession((s) => s ? { ...s, is_liked: true, like_count: (s.like_count ?? 0) + 1 } : s)}
              onUnlike={() => setSession((s) => s ? { ...s, is_liked: false, like_count: Math.max(0, (s.like_count ?? 1) - 1) } : s)}
              onRefresh={() => fetchSession()}
              token={() => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "")}
            />
            <LiveGiftPanel
              sessionId={session.id}
              token={() => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "")}
            />
          </div>
        )}
      </div>

      <BuyCreditsWidget className={styles.buyCreditsSection} />
    </div>
  );
}
