"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import styles from "../page.module.css";

export default function AdminTournamentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "status" | "prize_pool_sc">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<any>({
    game_id: "",
    name: "",
    description: "",
    entry_fee_sc: 10,
    max_players: 100,
    platform_cut_pct: 20,
    starts_at: "",
    ends_at: "",
  });
  const [games, setGames] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [playerQ, setPlayerQ] = useState("");
  const [playerSort, setPlayerSort] = useState<"rank" | "score" | "joined_at">("rank");
  const [editTournament, setEditTournament] = useState<any | null>(null);
  useEffect(() => {
    fetch("/api/admin/supanova/tournaments", { cache: "no-store" }).then((r) => r.json()).then((j) => setRows(j?.data ?? []));
    fetch("/api/admin/supanova/games", { cache: "no-store" }).then((r) => r.json()).then((j) => setGames(j?.data ?? []));
  }, []);
  const filtered = rows
    .filter((r) => `${r.name} ${r.game?.name ?? ""} ${r.status}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      const av = sortBy === "prize_pool_sc" ? Number(a?.[sortBy] ?? 0) : String(a?.[sortBy] ?? "").toLowerCase();
      const bv = sortBy === "prize_pool_sc" ? Number(b?.[sortBy] ?? 0) : String(b?.[sortBy] ?? "").toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  function statusBadge(status: string) {
    if (status === "live") return `${styles.badge} ${styles.badgeLive}`;
    if (status === "completed") return `${styles.badge} ${styles.badgeCompleted}`;
    if (status === "cancelled") return `${styles.badge} ${styles.badgeCancelled}`;
    return `${styles.badge} ${styles.badgeUpcoming}`;
  }
  async function setStatus(id: string, status: "upcoming" | "live" | "completed" | "cancelled") {
    const res = await fetch(`/api/admin/supanova/tournaments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const j = await res.json();
    if (!res.ok) return alert(j?.error ?? "Status update failed");
    setRows((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
  }
  const filteredPlayers = players
    .filter((p) => `${p.user?.display_name ?? ""} ${p.user?.username ?? ""}`.toLowerCase().includes(playerQ.toLowerCase()))
    .sort((a, b) => {
      if (playerSort === "score") return Number(b.score ?? 0) - Number(a.score ?? 0);
      if (playerSort === "joined_at") return String(b.joined_at ?? "").localeCompare(String(a.joined_at ?? ""));
      return Number(a.rank ?? 9999) - Number(b.rank ?? 9999);
    });
  const createPreview = (() => {
    const playersJoined = Math.max(0, Number(form.max_players ?? 0));
    const entry = Math.max(0, Number(form.entry_fee_sc ?? 0));
    const collected = playersJoined * entry;
    const cut = collected * (Math.max(0, Number(form.platform_cut_pct ?? 0)) / 100);
    const pool = collected - cut;
    const first = pool * 0.5;
    const second = pool * 0.3;
    const third = pool * 0.2;
    return { playersJoined, entry, collected, cut, pool, first, second, third };
  })();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
  function fmtDate(value?: string | null) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString();
  }
  return (
    <main className={styles.page}>
      <h1>Tournament Management</h1>
      <section className={styles.card}>
        <h3>Create Tournament</h3>
        <select className={styles.select} value={form.game_id} onChange={(e) => setForm({ ...form, game_id: e.target.value })}>
          <option value="">Select game</option>
          {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <input className={styles.input} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <textarea className={styles.textarea} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className={styles.row}>
          <input className={styles.input} type="number" min={0} value={Number(form.entry_fee_sc ?? 0)} onChange={(e) => setForm({ ...form, entry_fee_sc: Number(e.target.value) })} placeholder="Entry fee SC" />
          <input className={styles.input} type="number" min={2} value={Number(form.max_players ?? 0)} onChange={(e) => setForm({ ...form, max_players: Number(e.target.value) })} placeholder="Max players" />
          <input className={styles.input} type="number" min={0} max={90} value={Number(form.platform_cut_pct ?? 20)} onChange={(e) => setForm({ ...form, platform_cut_pct: Number(e.target.value) })} placeholder="Platform cut %" />
        </div>
        <div className={styles.row}>
          <input className={styles.input} type="datetime-local" value={form.starts_at || ""} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
          <input className={styles.input} type="datetime-local" value={form.ends_at || ""} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
        </div>
        <p className={styles.muted}>Timezone: {tz}</p>
        <div className={styles.panel}>
          <p className={styles.muted}>Preview if all slots fill</p>
          <p>Collected: {createPreview.collected.toFixed(2)} SC</p>
          <p>Platform: {createPreview.cut.toFixed(2)} SC</p>
          <p>Prize pool: {createPreview.pool.toFixed(2)} SC</p>
          <p className={styles.muted}>Payout split → 1st: {createPreview.first.toFixed(2)} SC • 2nd: {createPreview.second.toFixed(2)} SC • 3rd: {createPreview.third.toFixed(2)} SC</p>
        </div>
        <button className={styles.btn} onClick={async () => {
          const payload = {
            ...form,
            starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
            ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
          };
          const res = await fetch("/api/admin/supanova/tournaments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          if (!res.ok) return alert("Failed");
          const j = await res.json();
          setRows([j.data, ...rows]);
        }}>Save</button>
      </section>
      <div className={styles.row}>
        <input className={styles.input} placeholder="Search tournament/game/status" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className={styles.select} value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
          <option value="name">Sort: Name</option>
          <option value="status">Sort: Status</option>
          <option value="prize_pool_sc">Sort: Prize Pool</option>
        </select>
        <select className={styles.select} value={sortDir} onChange={(e) => setSortDir(e.target.value as any)}>
          <option value="asc">ASC</option>
          <option value="desc">DESC</option>
        </select>
      </div>
      <div className={`${styles.tableWrap} ${styles.desktopOnly}`}><table className={styles.table}><thead><tr><th>Name</th><th>Game</th><th>Status</th><th>Players</th><th>Entry</th><th>Prize</th><th>Starts</th><th>Ends</th><th>Actions</th></tr></thead><tbody>
        {paged.map((r) => <tr key={r.id}><td>{r.name}</td><td>{r.game?.name}</td><td><span className={statusBadge(String(r.status))}>{r.status}</span></td><td>{r.current_players}/{r.max_players}</td><td>{r.entry_fee_sc}</td><td>{r.prize_pool_sc}</td><td>{fmtDate(r.starts_at)}</td><td>{fmtDate(r.ends_at)}</td><td><div className={styles.row}><button className={styles.btnGhost} onClick={async () => { setSelected(r); setPlayerQ(""); const res = await fetch(`/api/admin/supanova/tournaments/${r.id}/players`, { cache: "no-store" }); const j = await res.json(); setPlayers(j?.data ?? []); }}>View Players</button><button className={styles.btnGhost} onClick={() => setEditTournament({ ...r })}>Edit</button><button className={styles.btnGhost} onClick={() => setStatus(r.id, "upcoming")}>Upcoming</button><button className={styles.btnGhost} onClick={() => setStatus(r.id, "live")}>Live</button><button className={styles.btn} onClick={async () => { const ok = window.confirm("End tournament and distribute prizes to top 3 players?"); if (!ok) return; const res = await fetch(`/api/admin/supanova/tournaments/${r.id}/end`, { method: "POST" }); const j = await res.json(); if (!res.ok) return alert(j?.error ?? "End failed"); alert("Tournament ended and prizes distributed."); const latest = await fetch("/api/admin/supanova/tournaments", { cache: "no-store" }).then((x) => x.json()); setRows(latest?.data ?? []); }}>End Tournament</button><button className={styles.btnGhost} onClick={async () => { const ok = window.confirm("Cancel this tournament?"); if (!ok) return; await setStatus(r.id, "cancelled"); }}>Cancel</button></div></td></tr>)}
      </tbody></table></div>
      <div className={styles.mobileOnly}>
        {paged.map((r) => (
          <article key={r.id} className={styles.mobileCard}>
            <p><b>{r.name}</b></p>
            <p className={styles.muted}>{r.game?.name} • {r.current_players}/{r.max_players}</p>
            <p><span className={statusBadge(String(r.status))}>{r.status}</span></p>
            <div className={styles.row}>
              <button className={styles.btnGhost} onClick={async () => { setSelected(r); setPlayerQ(""); const res = await fetch(`/api/admin/supanova/tournaments/${r.id}/players`, { cache: "no-store" }); const j = await res.json(); setPlayers(j?.data ?? []); }}>Players</button>
              <button className={styles.btnGhost} onClick={() => setEditTournament({ ...r })}>Edit</button>
              <button className={styles.btnGhost} onClick={() => setStatus(r.id, "live")}>Live</button>
              <button className={styles.btnGhost} onClick={() => setStatus(r.id, "upcoming")}>Upcoming</button>
              <button className={styles.btnGhost} onClick={() => setStatus(r.id, "cancelled")}>Cancel</button>
            </div>
          </article>
        ))}
      </div>
      <div className={styles.pager}>
        <button className={styles.btnGhost} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
        <span className={styles.muted}>Page {page} / {pageCount}</span>
        <button className={styles.btnGhost} disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button>
      </div>
      {editTournament && (
        <section className={styles.panel}>
          <h3>Edit Tournament • {editTournament.name}</h3>
          <div className={styles.formGrid}>
            <input className={styles.input} value={editTournament.name || ""} onChange={(e) => setEditTournament({ ...editTournament, name: e.target.value })} placeholder="Name" />
            <textarea className={styles.textarea} value={editTournament.description || ""} onChange={(e) => setEditTournament({ ...editTournament, description: e.target.value })} placeholder="Description" />
            <div className={styles.row}>
              <input className={styles.input} type="number" value={Number(editTournament.entry_fee_sc ?? 0)} onChange={(e) => setEditTournament({ ...editTournament, entry_fee_sc: Number(e.target.value) })} placeholder="Entry fee SC" />
              <input className={styles.input} type="number" value={Number(editTournament.max_players ?? 0)} onChange={(e) => setEditTournament({ ...editTournament, max_players: Number(e.target.value) })} placeholder="Max players" />
              <input className={styles.input} type="number" value={Number(editTournament.platform_cut_pct ?? 20)} onChange={(e) => setEditTournament({ ...editTournament, platform_cut_pct: Number(e.target.value) })} placeholder="Platform cut %" />
            </div>
            <div className={styles.row}>
              <input className={styles.input} type="datetime-local" value={String(editTournament.starts_at ?? "").slice(0, 16)} onChange={(e) => setEditTournament({ ...editTournament, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              <input className={styles.input} type="datetime-local" value={String(editTournament.ends_at ?? "").slice(0, 16)} onChange={(e) => setEditTournament({ ...editTournament, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </div>
            <div className={styles.row}>
              <button className={styles.btn} onClick={async () => {
                const res = await fetch(`/api/admin/supanova/tournaments/${editTournament.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: editTournament.name,
                    description: editTournament.description,
                    entry_fee_sc: editTournament.entry_fee_sc,
                    max_players: editTournament.max_players,
                    platform_cut_pct: editTournament.platform_cut_pct,
                    starts_at: editTournament.starts_at,
                    ends_at: editTournament.ends_at,
                  }),
                });
                const j = await res.json();
                if (!res.ok) return alert(j?.error ?? "Update failed");
                setRows((prev) => prev.map((x) => (x.id === editTournament.id ? { ...x, ...j.data } : x)));
                setEditTournament(null);
              }}>Save Tournament</button>
              <button className={styles.btnGhost} onClick={() => setEditTournament(null)}>Close</button>
            </div>
          </div>
        </section>
      )}
      {selected && (
        <section className={styles.panel}>
          <h3>Players • {selected.name}</h3>
          <div className={styles.row}>
            <input className={styles.input} placeholder="Search player" value={playerQ} onChange={(e) => setPlayerQ(e.target.value)} />
            <select className={styles.select} value={playerSort} onChange={(e) => setPlayerSort(e.target.value as any)}>
              <option value="rank">Sort: Rank</option>
              <option value="score">Sort: Score</option>
              <option value="joined_at">Sort: Joined</option>
            </select>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Rank</th><th>User</th><th>Score</th><th>SC Won</th><th>Joined</th></tr></thead>
              <tbody>{filteredPlayers.map((p) => <tr key={p.id}><td>{p.rank}</td><td>{p.user?.display_name ?? p.user?.username ?? p.user_id}</td><td>{p.score}</td><td>{p.sc_won}</td><td>{new Date(p.joined_at).toLocaleString()}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
