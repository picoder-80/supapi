"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import styles from "../page.module.css";

export default function AdminRevenuePage() {
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [from, setFrom] = useState(new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  useEffect(() => { fetch(`/api/admin/supanova/revenue?from=${from}&to=${to}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { setRows(j?.rows ?? []); setTotals(j?.totals ?? {}); }); }, [from, to]);
  return (
    <main className={styles.page}>
      <h1>Revenue Reports</h1>
      <div className={styles.btnRow}>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <a className={styles.btn} href={`/api/admin/supanova/revenue?from=${from}&to=${to}&format=csv`}>Export CSV</a>
      </div>
      <section className={styles.grid}>
        <article className={styles.card}><h3>Total Gross SC</h3><p>{Number(totals.gross_sc ?? 0).toFixed(2)}</p></article>
        <article className={styles.card}><h3>Platform Earned</h3><p>{Number(totals.platform_cut_sc ?? 0).toFixed(2)}</p></article>
        <article className={styles.card}><h3>Prizes Paid</h3><p>{Number(totals.prize_paid_sc ?? 0).toFixed(2)}</p></article>
        <article className={styles.card}><h3>Net SC</h3><p>{Number(totals.net_sc ?? 0).toFixed(2)}</p></article>
      </section>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Date</th><th>Source</th><th>Gross</th><th>Platform Cut</th><th>Prize Paid</th><th>Net</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.id}><td>{r.date}</td><td>{r.source}</td><td>{r.gross_sc}</td><td>{r.platform_cut_sc}</td><td>{r.prize_paid_sc}</td><td>{r.net_sc}</td></tr>)}
      </tbody></table></div>
    </main>
  );
}
