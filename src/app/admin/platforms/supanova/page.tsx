"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

export default function PlatformAdminPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [revenueRows, setRevenueRows] = useState<any[]>([]);
  const [dupPreview, setDupPreview] = useState<string>("");
  const [dupBusy, setDupBusy] = useState(false);

  const adminToken = () =>
    typeof window !== "undefined" ? localStorage.getItem("supapi_admin_token") ?? "" : "";

  const scanDupRewards = async () => {
    const t = adminToken();
    if (!t) {
      setDupPreview("Admin token missing — log in to Admin first.");
      return;
    }
    setDupBusy(true);
    setDupPreview("");
    try {
      const r = await fetch("/api/admin/supanova/reconcile-duplicate-rewards", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${t}` },
      });
      const j = await r.json();
      setDupPreview(JSON.stringify(j?.data ?? j, null, 2));
    } catch {
      setDupPreview("Request failed");
    } finally {
      setDupBusy(false);
    }
  };

  const fixDupRewards = async () => {
    if (!confirm("Reverse duplicate SupaNova reward SC for all affected sessions? This cannot be undone automatically.")) return;
    const t = adminToken();
    if (!t) {
      setDupPreview("Admin token missing.");
      return;
    }
    setDupBusy(true);
    setDupPreview("");
    try {
      const r = await fetch("/api/admin/supanova/reconcile-duplicate-rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ execute: true }),
      });
      const j = await r.json();
      setDupPreview(JSON.stringify(j?.data ?? j, null, 2));
    } catch {
      setDupPreview("Request failed");
    } finally {
      setDupBusy(false);
    }
  };

  useEffect(() => {
    fetch("/api/admin/supanova/tournaments", { cache: "no-store" }).then((r) => r.json()).then((j) => setTournaments(j?.data ?? []));
    fetch("/api/admin/supanova/revenue", { cache: "no-store" }).then((r) => r.json()).then((j) => setRevenueRows(j?.rows ?? []));
    fetch("/api/admin/supanova/players?pageSize=20", { cache: "no-store" }).then((r) => r.json()).then((j) => setSessions(j?.data ?? []));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayRevenue = useMemo(() => revenueRows.filter((r) => String(r.date) === today), [revenueRows, today]);
  const scSpent = todayRevenue.reduce((s, r) => s + Number(r.gross_sc ?? 0), 0);
  const platformEarned = todayRevenue.reduce((s, r) => s + Number(r.platform_cut_sc ?? 0), 0);
  const liveTournament = tournaments.filter((t) => t.status === "live").length;
  const trend = revenueRows.slice(-7);
  const maxTrend = Math.max(1, ...trend.map((r) => Number(r.platform_cut_sc ?? 0)));
  const points = trend
    .map((r, idx) => {
      const x = trend.length <= 1 ? 0 : Math.round((idx / (trend.length - 1)) * 100);
      const y = 100 - Math.round((Number(r.platform_cut_sc ?? 0) / maxTrend) * 100);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <main className={styles.page}>
      <p className={styles.crumb}>Admin → Platforms → SupaNova</p>
      <h1>🎮 SupaNova Overview</h1>
      <section className={styles.grid}>
        <article className={styles.card}><h3>SC Spent</h3><p>{scSpent.toFixed(2)}</p></article>
        <article className={styles.card}><h3>Platform Earned</h3><p>{platformEarned.toFixed(2)}</p></article>
        <article className={styles.card}><h3>Active Players</h3><p>{sessions.length}</p></article>
        <article className={styles.card}><h3>Live Tournaments</h3><p>{liveTournament}</p></article>
      </section>

      <section className={styles.btnRow}>
        <Link className={styles.btn} href="/admin/platforms/supanova/tournaments">Create Tournament</Link>
        <Link className={styles.btn} href="/admin/platforms/supanova/games">Manage Games</Link>
        <Link className={styles.btn} href="/admin/platforms/supanova/settings">Commission Settings</Link>
      </section>

      <section className={styles.card} style={{ marginTop: 16 }}>
        <h3>Duplicate reward cleanup</h3>
        <p style={{ opacity: 0.85, fontSize: 13, marginBottom: 12 }}>
          If users see repeated identical “MathRush reward” lines, scan first, then apply reversal (adjusts SC + leaderboard).
        </p>
        <div className={styles.btnRow}>
          <button type="button" className={styles.btn} disabled={dupBusy} onClick={scanDupRewards}>
            {dupBusy ? "…" : "Scan duplicates"}
          </button>
          <button type="button" className={styles.btn} disabled={dupBusy} onClick={fixDupRewards}>
            Apply fix
          </button>
        </div>
        {dupPreview && (
          <pre style={{ marginTop: 12, fontSize: 11, overflow: "auto", maxHeight: 220, whiteSpace: "pre-wrap" }}>
            {dupPreview}
          </pre>
        )}
      </section>

      <section className={styles.split}>
        <div className={styles.chart}>
          <h3>7-day Platform SC Earnings</h3>
          <div className={styles.sparkWrap}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="120" aria-label="earnings trend">
              <polyline fill="none" stroke="#f5a623" strokeWidth="2" points={points || "0,100 100,100"} />
            </svg>
            <div className={styles.legend}>
              <span>{trend[0]?.date ?? "-"}</span>
              <span>Max {maxTrend.toFixed(2)} SC</span>
              <span>{trend[trend.length - 1]?.date ?? "-"}</span>
            </div>
          </div>
          {trend.map((r, idx) => (
            <p key={`${r.date}-${String(r.source ?? "")}-${idx}`}>{r.date}: {Number(r.platform_cut_sc ?? 0).toFixed(2)} SC</p>
          ))}
        </div>
        <div className={styles.chart}>
          <h3>Top Games (today)</h3>
          {sessions.slice(0, 8).map((p, idx) => (
            <p key={`${p.user_id ?? "u"}-${idx}`}>{idx + 1}. {p.favourite_game} ({p.total_plays})</p>
          ))}
        </div>
      </section>
    </main>
  );
}