"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import styles from "../page.module.css";

export default function AdminPlayersPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { fetch(`/api/admin/supanova/players?q=${encodeURIComponent(q)}`, { cache: "no-store" }).then((r) => r.json()).then((j) => setRows(j?.data ?? [])); }, [q]);
  return (
    <main className={styles.page}>
      <h1>Player Stats</h1>
      <input placeholder="Search username" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Rank</th><th>Username</th><th>Total Plays</th><th>Spent</th><th>Earned</th><th>Favourite</th><th>Last Played</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.user_id}><td>{r.rank}</td><td>{r.username}</td><td>{r.total_plays}</td><td>{r.total_sc_spent}</td><td>{r.total_sc_earned}</td><td>{r.favourite_game}</td><td>{r.last_played ? new Date(r.last_played).toLocaleString() : "-"}</td></tr>)}
      </tbody></table></div>
    </main>
  );
}
