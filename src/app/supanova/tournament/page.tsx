"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "../page.module.css";

export default function TournamentPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/supanova/tournaments", { cache: "no-store" }).then((r) => r.json()).then((j) => setRows(j?.data ?? []));
  }, []);
  return (
    <main className={styles.page}>
      <header className={styles.topbar}><h1>🏆 Tournaments</h1></header>
      {rows.map((t) => (
        <article key={t.id} className={styles.card}>
          <h3>{t.game?.icon ?? "🎮"} {t.name}</h3>
          <p>{t.game?.name}</p>
          <p>Entry: {t.entry_fee_sc} SC • Prize: {t.prize_pool_sc} SC</p>
          <p>Players: {t.current_players}/{t.max_players} • {t.status}</p>
          <Link className={styles.playBtn} href={`/supanova/tournament/${t.id}`}>Join</Link>
        </article>
      ))}
    </main>
  );
}
