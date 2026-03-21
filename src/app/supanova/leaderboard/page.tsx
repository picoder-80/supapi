"use client";
export const dynamic = "force-dynamic";

import ScIcon from "@/components/icons/ScIcon";
import Link from "next/link";
import { useEffect, useState } from "react";
import lbStyles from "./leaderboard.module.css";
import subStyles from "../subpage.module.css";
import styles from "../page.module.css";

const GAMES: { slug: string; label: string }[] = [
  { slug: "brain-quiz", label: "Brain Quiz" },
  { slug: "word-master", label: "Word Master" },
  { slug: "math-rush", label: "Math Rush" },
  { slug: "memory-flip", label: "Memory Flip" },
  { slug: "type-speed", label: "Type Speed" },
  { slug: "lingua-quest", label: "Lingua Quest" },
  { slug: "geo-wiz", label: "Geo Wiz" },
  { slug: "code-breaker", label: "Code Breaker" },
];

type Row = {
  id: string;
  rank: number;
  high_score: number;
  total_plays: number;
  total_sc_earned: number;
  user: { username?: string; display_name?: string } | null;
};

function rankDisplay(rank: number) {
  if (rank === 1) return <span className={lbStyles.rankMedal}>🥇</span>;
  if (rank === 2) return <span className={lbStyles.rankMedal}>🥈</span>;
  if (rank === 3) return <span className={lbStyles.rankMedal}>🥉</span>;
  return rank;
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState(GAMES[0].slug);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/supanova/leaderboard?gameSlug=${encodeURIComponent(tab)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setRows(Array.isArray(j?.data) ? j.data : []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const currentLabel = GAMES.find((g) => g.slug === tab)?.label ?? tab;

  return (
    <main className={styles.page}>
      <div className={subStyles.wrap}>
        <Link href="/supanova" className={subStyles.back}>
          ← Back to lobby
        </Link>
        <h1 className={subStyles.pageTitle}>
          <span aria-hidden>🥇</span> Leaderboard
        </h1>
        <p className={subStyles.pageSub}>
          Top players by high score. Pick a game to see rankings — scores update when you finish levels.
          <Link href="/supanova/tournament" className={subStyles.inlineLink}>
            Tournaments →
          </Link>
        </p>
      </div>

      <div className={lbStyles.chipsWrap}>
        <section className={lbStyles.chips} aria-label="Select game">
          {GAMES.map(({ slug, label }) => (
            <button
              key={slug}
              type="button"
              className={tab === slug ? lbStyles.chipActive : lbStyles.chip}
              onClick={() => setTab(slug)}
            >
              {label}
            </button>
          ))}
        </section>
      </div>

      <section className={lbStyles.shell} aria-labelledby="lb-table-title">
        <h2 id="lb-table-title" className="visually-hidden">
          {currentLabel} leaderboard
        </h2>
        <div className={lbStyles.scroll}>
          {loading ? (
            <div className={`${subStyles.state} ${subStyles.pulse}`} role="status">
              <div className={subStyles.stateIcon}>⏳</div>
              <p className={subStyles.stateTitle}>Loading rankings…</p>
            </div>
          ) : rows.length === 0 ? (
            <div className={subStyles.state}>
              <div className={subStyles.stateIcon}>🎮</div>
              <p className={subStyles.stateTitle}>No scores yet</p>
              <p className={subStyles.stateHint}>
                Be the first to play <strong>{currentLabel}</strong> and set a high score.
              </p>
              <Link href={`/supanova/${tab}`} className={subStyles.cta}>
                Play {currentLabel}
              </Link>
            </div>
          ) : (
            <table className={lbStyles.table}>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Player</th>
                  <th scope="col">High score</th>
                  <th scope="col" className={lbStyles.thSc}>
                    <span className={lbStyles.scHead}>
                      <ScIcon size={14} decorative />
                      <span>Earned</span>
                    </span>
                  </th>
                  <th scope="col">Plays</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className={lbStyles.rank}>{rankDisplay(r.rank)}</td>
                    <td className={lbStyles.user} title={r.user?.display_name ?? r.user?.username ?? "Unknown"}>
                      {r.user?.display_name ?? r.user?.username ?? "Unknown"}
                    </td>
                    <td className={lbStyles.num}>{Number(r.high_score ?? 0).toLocaleString()}</td>
                    <td className={`${lbStyles.num} ${lbStyles.numHighlight} ${lbStyles.cellSc}`}>
                      <span className={lbStyles.scHead}>
                        <ScIcon size={13} decorative />
                        {Number(r.total_sc_earned ?? 0).toFixed(2)}
                      </span>
                    </td>
                    <td className={lbStyles.num}>{Number(r.total_plays ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
