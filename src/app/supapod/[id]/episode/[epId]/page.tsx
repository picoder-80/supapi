"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, use } from "react";
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
  podcast: { id: string; title: string; cover_url: string | null; creator: { username: string } };
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function EpisodePlayerPage({ params }: { params: Promise<{ id: string; epId: string }> }) {
  const { id, epId } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [played, setPlayed] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const f = async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/supapod/episodes/${epId}`);
        const d = await r.json();
        if (d.success) setEpisode(d.data);
      } catch {}
      setLoading(false);
    };
    f();
  }, [epId]);

  const handlePlay = () => {
    if (!played) {
      fetch(`/api/supapod/episodes/${epId}`, { method: "POST" }).catch(() => {});
      setPlayed(true);
    }
  };

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (!episode) return <div className={styles.notFound}><Link href={`/podcast/${id}`}>← Back</Link></div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>← Back</button>
        <Link href={`/podcast/${id}`} className={styles.podcastLink}>{episode.podcast?.title}</Link>
      </div>

      <div className={styles.player}>
        <div className={styles.cover}>
          {episode.podcast?.cover_url ? <img src={episode.podcast.cover_url} alt="" /> : <div className={styles.coverPlaceholder}>🎙️</div>}
        </div>
        <h1 className={styles.title}>{episode.title}</h1>
        <div className={styles.meta}>{fmtDuration(episode.duration_sec)} · {episode.plays} plays</div>

        <audio ref={audioRef} src={episode.audio_url} controls onPlay={handlePlay} className={styles.audio} />

        {episode.description && <div className={styles.desc}>{episode.description}</div>}

        {user && (
          <div className={styles.tipSection}>
            <Link href={`/podcast/${id}/episode/${epId}/tip`} className={styles.tipBtn}>
              💜 Tip Creator with Pi
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
