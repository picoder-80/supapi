"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import styles from "../page.module.css";

const tabs = ["brain-quiz", "word-master", "math-rush", "memory-flip", "type-speed", "lingua-quest", "geo-wiz", "code-breaker"];

export default function LeaderboardPage() {
  const [tab, setTab] = useState(tabs[0]);
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    fetch(`/api/supanova/leaderboard?gameSlug=${tab}`, { cache: "no-store" }).then((r) => r.json()).then((j) => setRows(j?.data ?? []));
  }, [tab]);
  return (
    <main className={styles.page}>
      <header className={styles.topbar}><h1>🥇 Leaderboard</h1></header>
      <section className={styles.chips}>
        {tabs.map((t) => <button key={t} className={tab === t ? styles.chipActive : styles.chip} onClick={() => setTab(t)}>{t}</button>)}
      </section>
      <section className={styles.card}>
        <table>
          <thead><tr><th>Rank</th><th>Username</th><th>High Score</th><th>SC Earned</th><th>Total Plays</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.rank}</td>
                <td>{r.user?.display_name ?? r.user?.username ?? "Unknown"}</td>
                <td>{r.high_score}</td>
                <td>{Number(r.total_sc_earned ?? 0).toFixed(2)}</td>
                <td>{r.total_plays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
