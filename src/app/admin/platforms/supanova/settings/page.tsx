"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import styles from "../page.module.css";

export default function AdminSettingsPage() {
  const [form, setForm] = useState({ game_play_cut_pct: 30, level_unlock_cut_pct: 30, tournament_cut_pct: 20, daily_earn_limit_sc: 500 });
  const [audit, setAudit] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  useEffect(() => {
    fetch("/api/admin/supanova/settings", { cache: "no-store" }).then((r) => r.json()).then((j) => j?.data && setForm(j.data));
    fetch("/api/admin/supanova/settings/audit", { cache: "no-store" }).then((r) => r.json()).then((j) => setAudit(j?.data ?? []));
  }, []);

  const preview = useMemo(() => {
    const spend = 10;
    const gross = 10;
    const cut = spend * (Number(form.game_play_cut_pct) / 100);
    const net = gross - cut;
    const total = 10 * 20;
    const tCut = total * (Number(form.tournament_cut_pct) / 100);
    const pool = total - tCut;
    return { spend, gross, cut, net, total, tCut, pool };
  }, [form]);

  return (
    <main className={styles.page}>
      <h1>SupArcade Commission Settings</h1>
      <p>Changes take effect immediately on the next game session</p>
      <section className={styles.card}>
        <label>Game Play Cut (%)
          <input className={styles.input} type="number" min={1} max={90} value={form.game_play_cut_pct} onChange={(e) => setForm({ ...form, game_play_cut_pct: Number(e.target.value) })} />
        </label>
        <label>Level Unlock Cut (%)
          <input className={styles.input} type="number" min={1} max={90} value={form.level_unlock_cut_pct} onChange={(e) => setForm({ ...form, level_unlock_cut_pct: Number(e.target.value) })} />
        </label>
        <label>Tournament Entry Cut (%)
          <input className={styles.input} type="number" min={1} max={90} value={form.tournament_cut_pct} onChange={(e) => setForm({ ...form, tournament_cut_pct: Number(e.target.value) })} />
        </label>
        <label>Daily SC Earn Limit Per Player
          <input className={styles.input} type="number" min={10} max={10000} value={form.daily_earn_limit_sc} onChange={(e) => setForm({ ...form, daily_earn_limit_sc: Number(e.target.value) })} />
        </label>
      </section>
      <section className={styles.card}>
        <h3>Commission Preview</h3>
        <p>Player spends {preview.spend} SC</p>
        <p>Player earns max {preview.gross.toFixed(2)} SC gross</p>
        <p>Platform cut: {preview.cut.toFixed(2)} SC</p>
        <p>Player receives: {preview.net.toFixed(2)} SC</p>
        <p>Tournament 10 players x 20 SC = {preview.total} SC</p>
        <p>Platform cut: {preview.tCut.toFixed(2)} SC • Prize pool: {preview.pool.toFixed(2)} SC</p>
      </section>
      <button className={styles.btn} disabled={saving} onClick={async () => {
        setSaving(true);
        const token = typeof window !== "undefined" ? localStorage.getItem("supapi_token") : "";
        const res = await fetch("/api/admin/supanova/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
          body: JSON.stringify(form),
        });
        const j = await res.json();
        setSaving(false);
        if (res.ok) {
          setToast({ type: "ok", msg: "Settings saved — effective immediately" });
          const latestAudit = await fetch("/api/admin/supanova/settings/audit", { cache: "no-store" }).then((x) => x.json());
          setAudit(latestAudit?.data ?? []);
        } else {
          setToast({ type: "err", msg: j?.error ?? "Failed to save settings" });
        }
      }}>Save Commission Settings</button>
      {toast && <p className={toast.type === "ok" ? styles.ok : styles.danger}>{toast.msg}</p>}

      <h3>Change History</h3>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Date</th><th>Admin</th><th>Game Play</th><th>Tournament</th><th>Level Unlock</th></tr></thead><tbody>
        {audit.map((a) => <tr key={a.id}><td>{new Date(a.changed_at).toLocaleString()}</td><td>{a.admin?.display_name ?? a.admin?.username ?? "-"}</td><td>{a.old_game_play_cut}%→{a.new_game_play_cut}%</td><td>{a.old_tournament_cut}%→{a.new_tournament_cut}%</td><td>{a.old_level_unlock_cut}%→{a.new_level_unlock_cut}%</td></tr>)}
      </tbody></table></div>
    </main>
  );
}
