"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type Game = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  is_free: boolean;
  cost_sc: number;
  max_earn_sc: number;
};

type Tournament = {
  id: string;
  name: string;
  starts_at: string | null;
  prize_pool_sc: number;
  game?: { name: string } | null;
};

export default function SupaNovaPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [wallet, setWallet] = useState(0);
  const [filter, setFilter] = useState<"all" | "free" | "paid" | "popular">("all");
  const [featured, setFeatured] = useState<Tournament | null>(null);
  const [now, setNow] = useState(Date.now());
  const token = typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "";

  useEffect(() => {
    fetch("/api/supanova/games", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setGames(j?.data ?? []))
      .catch(() => setGames([]));
    fetch("/api/supanova/tournaments", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const first = (j?.data ?? []).find((t: any) => ["upcoming", "live"].includes(String(t.status)));
        setFeatured(first ?? null);
      })
      .catch(() => setFeatured(null));
    fetch("/api/credits", {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((j) => setWallet(Number(j?.data?.wallet?.balance ?? 0)))
      .catch(() => setWallet(0));
  }, [token]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    if (filter === "free") return games.filter((g) => g.is_free);
    if (filter === "paid") return games.filter((g) => !g.is_free);
    if (filter === "popular") return [...games].sort((a, b) => Number(b.max_earn_sc) - Number(a.max_earn_sc));
    return games;
  }, [filter, games]);

  const leftMs = featured?.starts_at ? new Date(featured.starts_at).getTime() - now : 0;
  const hh = Math.max(0, Math.floor(leftMs / 3600000));
  const mm = Math.max(0, Math.floor((leftMs % 3600000) / 60000));
  const ss = Math.max(0, Math.floor((leftMs % 60000) / 1000));

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <h1>🎮 SupArcade</h1>
        <div className={styles.balance}>💎 {wallet.toFixed(2)} SC</div>
      </header>

      <section className={styles.chips}>
        {[
          ["all", "All"],
          ["free", "Free"],
          ["paid", "Paid"],
          ["popular", "Popular"],
        ].map(([id, label]) => (
          <button key={id} className={filter === id ? styles.chipActive : styles.chip} onClick={() => setFilter(id as any)}>
            {label}
          </button>
        ))}
      </section>

      <section className={styles.grid}>
        {filtered.map((game) => {
          const insufficient = !game.is_free && wallet < Number(game.cost_sc ?? 0);
          return (
            <article key={game.id} className={styles.card}>
              <div className={styles.banner}>
                <span className={styles.icon}>{game.icon || "🎮"}</span>
              </div>
              <h3>{game.name}</h3>
              <p>{game.description}</p>
              <div className={styles.meta}>
                {game.is_free ? <span className={styles.free}>FREE</span> : <span className={styles.paid}>{game.cost_sc} SC</span>}
                <small>Earn up to {game.max_earn_sc} SC</small>
              </div>
              <Link href={insufficient ? "/wallet" : `/supanova/${game.slug}`} className={styles.playBtn}>
                {insufficient ? "🔒 Buy SC" : "Play Now"}
              </Link>
            </article>
          );
        })}
      </section>

      {featured && (
        <section className={styles.featured}>
          <span>Next Tournament</span>
          <h2>{featured.name}</h2>
          <p>{featured.game?.name ?? "Arcade Game"}</p>
          <strong>💎 {Number(featured.prize_pool_sc ?? 0).toFixed(2)} SC</strong>
          <div className={styles.countdown}>{hh}h {mm}m {ss}s</div>
          <Link href={`/supanova/tournament/${featured.id}`} className={styles.playBtn}>Join Now</Link>
        </section>
      )}
    </main>
  );
}
