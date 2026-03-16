"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import BuyCreditsWidget from "@/components/BuyCreditsWidget";
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
    viewer_count: number;
    user?: { username: string; display_name: string | null; avatar_url: string | null };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/live/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) setSession(d.data);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

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

  const name = session.user?.display_name ?? session.user?.username ?? "?";

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/live" className={styles.backBtn}>← Back</Link>
        <h1 className={styles.title}>🔴 Live</h1>
      </div>

      <div className={styles.body}>
        <div className={styles.liveCard}>
          <div className={styles.liveVideoWrap}>
            <div className={styles.livePlaceholder} />
            <span className={styles.liveBadge}>● LIVE</span>
            <span className={styles.liveViewerCount}>👁 {session.viewer_count} watching</span>
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
      </div>

      <BuyCreditsWidget className={styles.buyCreditsSection} />
    </div>
  );
}
