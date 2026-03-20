"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import styles from "../../page.module.css";

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("supapi_token") : "";
  const item = useMemo(() => rows.find((x) => String(x.id) === String(id)) ?? null, [rows, id]);
  useEffect(() => {
    fetch("/api/supanova/tournaments", { cache: "no-store" }).then((r) => r.json()).then((j) => setRows(j?.data ?? []));
  }, []);
  return (
    <main className={styles.page}>
      <header className={styles.topbar}><h1>🏆 Tournament Detail</h1></header>
      {!item ? <p>Loading...</p> : (
        <section className={styles.card}>
          <h2>{item.name}</h2>
          <p>{item.description}</p>
          <p>Entry: {item.entry_fee_sc} SC • Prize pool: {item.prize_pool_sc} SC</p>
          <button className={styles.playBtn} disabled={busy} onClick={async () => {
            setBusy(true);
            const res = await fetch(`/api/supanova/tournament/${id}/join`, { method: "POST", headers: { Authorization: token ? `Bearer ${token}` : "" } });
            const json = await res.json();
            setBusy(false);
            alert(res.ok ? "Joined tournament" : (json?.error ?? "Join failed"));
          }}>Join Now</button>
        </section>
      )}
    </main>
  );
}
