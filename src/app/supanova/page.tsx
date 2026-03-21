"use client";
export const dynamic = "force-dynamic";

import BuyCreditsWidget from "@/components/BuyCreditsWidget";
import ScIcon from "@/components/icons/ScIcon";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type Game = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
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
  const [buyScOpen, setBuyScOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const token = typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "";

  const refreshWallet = useCallback(() => {
    fetch("/api/credits", {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((j) => setWallet(Number(j?.data?.wallet?.balance ?? 0)))
      .catch(() => setWallet(0));
  }, [token]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

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
    refreshWallet();
  }, [refreshWallet]);

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
      <section className={styles.hero} aria-label="SupaNova introduction">
        <div className={styles.heroInner}>
          <span className={styles.heroBadge}>🎮 Learn &amp; Play</span>
          <h1 className={styles.heroTitle}>
            SupaNova —{" "}
            <span className={styles.heroGold}>
              play &amp; earn SC<ScIcon size={22} className={styles.heroScInTitle} />
            </span>
          </h1>
          <p className={styles.heroSub}>
            Mini-games, tournaments &amp; leaderboards. Spend SC (Supa Credits) to play paid levels or earn rewards.
          </p>
          <div className={styles.heroActions}>
            <a href="#games" className={styles.heroBtnPrimary}>Browse games</a>
            <Link href="/supanova/tournament" className={styles.heroBtnOutline}>Tournaments</Link>
            <Link href="/supanova/leaderboard" className={styles.heroBtnOutline}>Leaderboard</Link>
          </div>
          <div className={styles.heroBalanceRow}>
            <span className={styles.balance}>
              <ScIcon size={18} className={styles.balanceLeadingIcon} />
              {wallet.toFixed(2)}
            </span>
            <button
              type="button"
              className={`${styles.heroLinkSubtle} ${styles.heroLinkBtn}`}
              onClick={() => setBuyScOpen(true)}
            >
              <span className={styles.topUpLabel}>
                <ScIcon size={14} />
                Top up SC
              </span>
            </button>
          </div>
        </div>
      </section>

      <div className={styles.inner}>
        <section id="games" className={styles.chipWrap} aria-label="Filter games">
          {[
            ["all", "All"],
            ["free", "Free"],
            ["paid", "Paid"],
            ["popular", "Popular"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={filter === id ? styles.chipActive : styles.chip}
              onClick={() => setFilter(id as "all" | "free" | "paid" | "popular")}
            >
              {label}
            </button>
          ))}
        </section>

        <section className={styles.grid} aria-label="Games">
          {filtered.map((game) => {
            const insufficient = !game.is_free && wallet < Number(game.cost_sc ?? 0);
            return (
              <article key={game.id} className={styles.card}>
                <div className={styles.banner}>
                  <span className={styles.icon}>{game.icon || "🎮"}</span>
                </div>
                <h3 className={styles.cardTitle}>{game.name}</h3>
                <p className={styles.cardDesc}>{game.description}</p>
                <div className={styles.meta}>
                  {game.is_free ? (
                    <span className={styles.free}>FREE</span>
                  ) : (
                    <span className={styles.paid}>
                      {game.cost_sc} <ScIcon size={13} />
                    </span>
                  )}
                  <small className={styles.earnLine}>
                    Earn up to {game.max_earn_sc} <ScIcon size={11} />
                  </small>
                </div>
                {insufficient ? (
                  <button type="button" className={styles.playBtn} onClick={() => setBuyScOpen(true)}>
                    <span className={styles.buyScBtnInner}>
                      🔒 Buy <ScIcon size={13} />
                    </span>
                  </button>
                ) : (
                  <Link href={`/supanova/${game.slug}`} className={styles.playBtn}>
                    Play Now
                  </Link>
                )}
              </article>
            );
          })}
        </section>

        {featured && (
          <section className={styles.featuredWrap} aria-label="Featured tournament">
            <div className={styles.featured}>
              <div className={styles.featuredInner}>
                <span className={styles.featuredLabel}>Next tournament</span>
                <h2 className={styles.featuredTitle}>{featured.name}</h2>
                <p className={styles.featuredSub}>{featured.game?.name ?? "SupaNova game"}</p>
                <span className={styles.featuredPrize}>
                  <ScIcon size={18} />
                  {Number(featured.prize_pool_sc ?? 0).toFixed(2)}
                </span>
                <div className={styles.countdown}>
                  {hh}h {mm}m {ss}s
                </div>
                <Link href={`/supanova/tournament/${featured.id}`} className={styles.playBtn}>
                  Join Now
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>

      {buyScOpen && (
        <div className={styles.buyScOverlay} role="dialog" aria-modal="true" aria-labelledby="buy-sc-title">
          <div className={styles.buyScBackdrop} aria-hidden onClick={() => setBuyScOpen(false)} />
          <div className={styles.buyScSheet}>
            <button type="button" className={styles.buyScClose} onClick={() => setBuyScOpen(false)} aria-label="Close">
              ×
            </button>
            <div id="buy-sc-title" className={styles.buyScSheetTitle}>
              Top up <ScIcon size={16} />
            </div>
            <BuyCreditsWidget
              showTitle={false}
              variant="default"
              onSuccess={() => {
                refreshWallet();
                setBuyScOpen(false);
              }}
              onMessage={showToast}
              className={styles.buyScWidget}
            />
          </div>
        </div>
      )}

      {toast && <div className={styles.toast} role="status">{toast}</div>}
    </main>
  );
}
