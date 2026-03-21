"use client";
export const dynamic = "force-dynamic";

import ScIcon from "@/components/icons/ScIcon";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import subStyles from "../../subpage.module.css";
import styles from "../../page.module.css";

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

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [rows, setRows] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const token = typeof window !== "undefined" ? localStorage.getItem("supapi_token") : "";

  const item = useMemo(() => rows.find((x) => String(x.id) === String(id)) ?? null, [rows, id]);

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
        <Link href="/supanova/tournament" className={subStyles.back}>
          ← All tournaments
        </Link>
        <h1 className={subStyles.pageTitle}>
          <span aria-hidden>🏆</span> Tournament
        </h1>
        <p className={subStyles.pageSub}>
          Confirm entry fee and prize pool before joining.
          <Link href="/supanova/leaderboard" className={subStyles.inlineLink}>
            Leaderboard →
          </Link>
        </p>
      </div>

      {loading ? (
        <div className={`${subStyles.state} ${subStyles.pulse}`} role="status">
          <div className={subStyles.stateIcon}>⏳</div>
          <p className={subStyles.stateTitle}>Loading…</p>
        </div>
      ) : !item ? (
        <div className={subStyles.state}>
          <div className={subStyles.stateIcon}>❓</div>
          <p className={subStyles.stateTitle}>Tournament not found</p>
          <p className={subStyles.stateHint}>It may have been removed or the link is invalid.</p>
          <Link href="/supanova/tournament" className={subStyles.cta}>
            All tournaments
          </Link>
        </div>
      ) : (
        <section className={`${styles.card} ${subStyles.detailCard}`}>
          <div className={subStyles.cardTop}>
            <span className={subStyles.cardGameIcon}>{item.game?.icon ?? "🎮"}</span>
            <div className={subStyles.cardTitles}>
              <h2 className={subStyles.detailTitle}>{item.name}</h2>
              <p className={subStyles.cardGameName}>{item.game?.name ?? "SupaNova game"}</p>
            </div>
          </div>
          {item.description ? <p className={subStyles.detailDesc}>{item.description}</p> : null}
          <div className={`${subStyles.statsRow} ${subStyles.detailStats}`}>
            <span className={subStyles.stat}>
              <span className={subStyles.statLabel}>Entry</span>
              <ScIcon size={14} decorative />
              {Number(item.entry_fee_sc ?? 0).toFixed(0)}
            </span>
            <span className={subStyles.stat}>
              <span className={subStyles.statLabel}>Prize pool</span>
              <ScIcon size={14} decorative />
              {Number(item.prize_pool_sc ?? 0).toFixed(0)}
            </span>
            <span className={subStyles.stat}>
              <span className={subStyles.statLabel}>Players</span>
              {item.current_players}/{item.max_players}
            </span>
            <span className={subStyles.stat}>
              <span className={subStyles.statLabel}>Status</span>
              {String(item.status)}
            </span>
          </div>
          {msg ? (
            <p
              role="status"
              style={{ color: msg.ok ? "#15803d" : "#b91c1c", marginBottom: "var(--space-3)", fontWeight: 600 }}
            >
              {msg.text}
            </p>
          ) : null}
          <button
            type="button"
            className={styles.playBtn}
            disabled={busy}
            onClick={async () => {
              setMsg(null);
              setBusy(true);
              try {
                const res = await fetch(`/api/supanova/tournament/${id}/join`, {
                  method: "POST",
                  headers: { Authorization: token ? `Bearer ${token}` : "" },
                });
                const json = await res.json();
                if (res.ok) setMsg({ ok: true, text: "Joined tournament." });
                else setMsg({ ok: false, text: String(json?.error ?? "Join failed") });
              } catch {
                setMsg({ ok: false, text: "Network error" });
              }
              setBusy(false);
            }}
          >
            {busy ? "Please wait…" : "Join now"}
          </button>
        </section>
      )}
    </main>
  );
}
