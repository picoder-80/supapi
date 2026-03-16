"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./page.module.css";

interface Episode {
  id: string;
  title: string;
  description: string;
  audio_url: string;
  duration_sec: number;
  plays: number;
  episode_number: number | null;
  published_at: string | null;
}

interface Podcast {
  id: string;
  title: string;
  description: string;
  cover_url: string | null;
  category: string;
  total_plays: number;
  total_episodes: number;
  creator_id: string;
  creator: { id: string; username: string; display_name: string | null; avatar_url: string | null };
  episodes: Episode[];
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PodcastDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const f = async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/supapod/podcasts/${id}`);
        const d = await r.json();
        if (d.success) setPodcast(d.data);
      } catch {}
      setLoading(false);
    };
    f();
  }, [id]);

  const isCreator = user?.id === podcast?.creator_id;

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (!podcast) return <div className={styles.notFound}><Link href="/supapod">← Back</Link></div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>← Back</button>
        {isCreator && <Link href={`/supapod/${id}/add-episode`} className={styles.addBtn}>+ Add Episode</Link>}
      </div>

      <div className={styles.hero}>
        <div className={styles.cover}>
          {podcast.cover_url ? <img src={podcast.cover_url} alt="" /> : <div className={styles.coverPlaceholder}>🎙️</div>}
        </div>
        <h1 className={styles.title}>{podcast.title}</h1>
        <Link href={`/supaspace/${podcast.creator?.username}`} className={styles.creator}>
          {podcast.creator?.display_name ?? podcast.creator?.username}
        </Link>
        <div className={styles.stats}>
          <span>▶ {podcast.total_plays} plays</span>
          <span>•</span>
          <span>{podcast.total_episodes} episodes</span>
        </div>
        {podcast.description && <p className={styles.desc}>{podcast.description}</p>}
      </div>

      <div className={styles.episodes}>
        <h2 className={styles.epTitle}>Episodes</h2>
        {podcast.episodes?.length === 0 ? (
          <div className={styles.empty}>No episodes yet</div>
        ) : (
          podcast.episodes?.map((ep, i) => (
            <Link key={ep.id} href={`/supapod/${id}/episode/${ep.id}`} className={styles.epRow}>
              <span className={styles.epNum}>{ep.episode_number ?? i + 1}</span>
              <div className={styles.epInfo}>
                <div className={styles.epName}>{ep.title}</div>
                <div className={styles.epMeta}>{fmtDuration(ep.duration_sec)} · {ep.plays} plays</div>
              </div>
              <span className={styles.epPlay}>▶</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
