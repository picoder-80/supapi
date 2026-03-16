"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./page.module.css";

const CATEGORIES = [
  { id: "", label: "All" },
  { id: "comedy", label: "Comedy" },
  { id: "education", label: "Education" },
  { id: "true_crime", label: "True Crime" },
  { id: "news", label: "News" },
  { id: "music", label: "Music" },
  { id: "technology", label: "Technology" },
  { id: "others", label: "Others" },
];

interface Podcast {
  id: string;
  title: string;
  description: string;
  cover_url: string | null;
  category: string;
  total_plays: number;
  total_episodes: number;
  created_at: string;
  creator: { id: string; username: string; display_name: string | null; avatar_url: string | null };
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d === 0 ? "Today" : d === 1 ? "Yesterday" : d < 7 ? `${d}d ago` : d < 30 ? `${Math.floor(d / 7)}w ago` : `${Math.floor(d / 30)}mo ago`;
}

export default function PodcastPage() {
  const { user } = useAuth();
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const fetchPodcasts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", sort: "newest" });
      if (category) params.set("category", category);
      if (q) params.set("q", q);
      const r = await fetch(`/api/supapod/podcasts?${params}`);
      const d = await r.json();
      if (d.success) {
        setPodcasts(d.data.podcasts ?? []);
        setTotal(d.data.total ?? 0);
      }
    } catch {}
    setLoading(false);
  }, [category, q]);

  useEffect(() => { fetchPodcasts(); }, [fetchPodcasts]);

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <div className={styles.heroBadge}>Pi Network · Audio</div>
            <h1 className={styles.heroTitle}>🎙️ SupaPod</h1>
            <p className={styles.heroSub}>Create, listen & tip podcasters with Pi</p>
          </div>
          <Link href="/supapod/create" className={styles.createBtn}>+ Create</Link>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <span className={styles.heroStatNum}>{total}</span>
            <span className={styles.heroStatLabel}>Podcasts</span>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setQ(searchInput); }} className={styles.searchRow}>
          <input className={styles.searchInput} placeholder="Search podcasts..." value={searchInput} onChange={e => setSearchInput(e.target.value)} />
          <button type="submit" className={styles.searchBtn}>🔍</button>
        </form>
        <div className={styles.catScroll}>
          {CATEGORIES.map(c => (
            <button key={c.id} className={`${styles.catPill} ${category === c.id ? styles.catPillActive : ""}`}
              onClick={() => setCategory(c.id)}>{c.label}</button>
          ))}
        </div>
      </div>

      <section className={styles.contentSection}>
        <div className="container">
          <div className={styles.body}>
            {loading ? (
              <div className={styles.grid}>
                {[...Array(6)].map((_, i) => <div key={i} className={styles.skeleton} />)}
              </div>
            ) : podcasts.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🎙️</div>
                <div className={styles.emptyTitle}>No podcasts yet</div>
                <div className={styles.emptyDesc}>Be the first to create a podcast!</div>
                <Link href="/supapod/create" className={styles.emptyBtn}>+ Create Podcast</Link>
              </div>
            ) : (
              <div className={styles.grid}>
                {podcasts.map(p => (
                  <Link key={p.id} href={`/supapod/${p.id}`} className={styles.card}>
                    <div className={styles.cover}>
                      {p.cover_url ? <img src={p.cover_url} alt="" className={styles.coverImg} /> : <div className={styles.coverPlaceholder}>🎙️</div>}
                      <div className={styles.coverOverlay}>
                        <span className={styles.playCount}>▶ {p.total_plays}</span>
                        <span className={styles.epCount}>{p.total_episodes} eps</span>
                      </div>
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.cardTitle}>{p.title}</div>
                      <div className={styles.cardMeta}>
                        {p.creator?.display_name ?? p.creator?.username} · {timeAgo(p.created_at)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
