"use client";
export const dynamic = "force-dynamic";

import ScIcon from "@/components/icons/ScIcon";
import Link from "next/link";
import { useEffect, useState } from "react";
import subStyles from "../subpage.module.css";
import styles from "../page.module.css";

type Tournament = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  entry_fee_sc: number;
  prize_pool_sc: number;
  current_players: number;
  max_players: number;
  game?: { name?: string; icon?: string } | null;
};

function statusPillClasses(status: string) {
  const x = String(status).toLowerCase();
  if (x === "live") return `${subStyles.statusPill} ${subStyles.statusLive}`;
  if (x === "ended" || x === "completed") return `${subStyles.statusPill} ${subStyles.statusEnded}`;
  return `${subStyles.statusPill} ${subStyles.statusUpcoming}`;
}

export default function TournamentPage() {
  const [rows, setRows] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/supanova/tournaments", { cache: "no-store" })
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
  }, []);

  return (
    <main className={styles.page}>
      <div className={subStyles.wrap}>
        <Link href="/supanova" className={subStyles.back}>
          ← Back to lobby
        </Link>
        <h1 className={subStyles.pageTitle}>
          <span aria-hidden>🏆</span> Tournaments
        </h1>
        <p className={subStyles.pageSub}>
          Join timed events and compete for prize pools. Entry fees and prizes use Supapi Credits.
          <Link href="/supanova/leaderboard" className={subStyles.inlineLink}>
            Leaderboard →
          </Link>
        </p>
      </div>

      {loading ? (
        <div className={`${subStyles.state} ${subStyles.pulse}`} role="status">
          <div className={subStyles.stateIcon}>⏳</div>
          <p className={subStyles.stateTitle}>Loading tournaments…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className={subStyles.state}>
          <div className={subStyles.stateIcon}>🏆</div>
          <p className={subStyles.stateTitle}>No tournaments yet</p>
          <p className={subStyles.stateHint}>Check back soon or play games from the lobby to climb the leaderboard.</p>
          <Link href="/supanova" className={subStyles.cta}>
            Back to lobby
          </Link>
        </div>
      ) : (
        <div className={subStyles.list}>
          {rows.map((t) => (
            <article key={t.id} className={`${styles.card} ${subStyles.tournamentCard}`}>
              <div className={subStyles.cardTop}>
                <span className={subStyles.cardGameIcon}>{t.game?.icon ?? "🎮"}</span>
                <div className={subStyles.cardTitles}>
                  <h2 className={subStyles.cardName}>{t.name}</h2>
                  <p className={subStyles.cardGameName}>{t.game?.name ?? "SupaNova game"}</p>
                </div>
              </div>
              <div className={subStyles.statusRow}>
                <span className={statusPillClasses(t.status)}>{String(t.status)}</span>
              </div>
              <div className={subStyles.statsRow}>
                <span className={subStyles.stat}>
                  <span className={subStyles.statLabel}>Entry</span>
                  <ScIcon size={13} decorative />
                  {Number(t.entry_fee_sc ?? 0).toFixed(0)}
                </span>
                <span className={subStyles.stat}>
                  <span className={subStyles.statLabel}>Prize</span>
                  <ScIcon size={13} decorative />
                  {Number(t.prize_pool_sc ?? 0).toFixed(0)}
                </span>
                <span className={subStyles.stat}>
                  <span className={subStyles.statLabel}>Players</span>
                  {t.current_players}/{t.max_players}
                </span>
              </div>
              <Link className={styles.playBtn} href={`/supanova/tournament/${t.id}`}>
                View &amp; join
              </Link>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
