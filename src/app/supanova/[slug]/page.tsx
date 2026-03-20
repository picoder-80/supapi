"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import BrainQuiz from "../games/BrainQuiz";
import CodeBreaker from "../games/CodeBreaker";
import GeoWiz from "../games/GeoWiz";
import LinguaQuest from "../games/LinguaQuest";
import MathRush from "../games/MathRush";
import MemoryFlip from "../games/MemoryFlip";
import TypeSpeed from "../games/TypeSpeed";
import WordMaster from "../games/WordMaster";
import styles from "./page.module.css";

type Level = { id: string; level_number: number; is_free: boolean; cost_sc: number; reward_sc: number; difficulty: string; name?: string };
type Game = { id: string; slug: string; name: string; icon: string; description: string; cost_sc: number };

export default function GameSlugPage() {
  const params = useParams<{ slug: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [selected, setSelected] = useState<Level | null>(null);
  const [wallet, setWallet] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [starting, setStarting] = useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("supapi_token") : "";

  useEffect(() => {
    fetch(`/api/supanova/games/${params.slug}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const payload = j?.data;
        setGame(payload?.game ?? null);
        setLevels(payload?.levels ?? []);
        setSelected(payload?.levels?.[0] ?? null);
      });
    fetch("/api/credits", {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then((r) => r.json()).then((j) => setWallet(Number(j?.data?.wallet?.balance ?? 0)));
  }, [params.slug]);

  async function startPlay() {
    if (!selected || starting) return;
    setStarting(true);
    const res = await fetch("/api/supanova/play", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
      body: JSON.stringify({ gameSlug: params.slug, levelId: selected.id }),
    });
    const json = await res.json();
    if (!res.ok) {
      setStarting(false);
      return alert(json?.error ?? "Failed to start");
    }
    setSessionId(json?.data?.sessionId ?? null);
    setResult(null);
    setStarting(false);
  }

  async function onComplete(score: number, timeTaken: number) {
    if (!sessionId) return;
    const res = await fetch("/api/supanova/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
      body: JSON.stringify({ sessionId, score, timeTaken }),
    });
    const json = await res.json();
    if (!res.ok) return alert(json?.error ?? "Failed to complete");
    setResult({ score, ...json.data });
    setSessionId(null);
    fetch("/api/credits", {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then((r) => r.json()).then((j) => setWallet(Number(j?.data?.wallet?.balance ?? 0)));
  }

  const cannotAfford = useMemo(() => !!selected && !selected.is_free && wallet < Number(selected.cost_sc ?? 0), [selected, wallet]);

  function gameComp() {
    if (!selected || !sessionId) return null;
    const props = { level: selected, onComplete };
    switch (params.slug) {
      case "brain-quiz": return <BrainQuiz {...props} />;
      case "word-master": return <WordMaster {...props} />;
      case "math-rush": return <MathRush {...props} />;
      case "memory-flip": return <MemoryFlip {...props} />;
      case "type-speed": return <TypeSpeed {...props} />;
      case "lingua-quest": return <LinguaQuest {...props} />;
      case "geo-wiz": return <GeoWiz {...props} />;
      case "code-breaker": return <CodeBreaker {...props} />;
      default: return <div>Game not available.</div>;
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{game?.icon ?? "🎮"} {game?.name ?? "Game"}</h1>
        <div>💎 {wallet.toFixed(2)} SC</div>
      </header>

      {cannotAfford && <div className={styles.warn}>Insufficient SC for this level. Top up SC first.</div>}

      <section className={styles.tabs}>
        {levels.map((l) => (
          <button key={l.id} className={selected?.id === l.id ? styles.tabActive : styles.tab} onClick={() => setSelected(l)}>
            L{l.level_number} {l.is_free ? "Free" : `🔒 ${l.cost_sc} SC`}
          </button>
        ))}
      </section>

      <section className={styles.playArea}>
        {!sessionId ? (
          <button className={styles.primaryBtn} onClick={startPlay} disabled={!selected || cannotAfford || starting}>
            {starting ? "Starting..." : "Start Level"}
          </button>
        ) : (
          gameComp()
        )}
      </section>

      {result && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2>Result</h2>
            <p className={styles.score}>{result.score}</p>
            <p>SC Earned: <b>{Number(result.scEarned ?? 0).toFixed(2)}</b></p>
            {result.rewardMessage && <p>{result.rewardMessage}</p>}
            <p>SC Spent: <b>{Number(selected?.cost_sc ?? 0).toFixed(2)}</b></p>
            <p>Net: <b>{(Number(result.scEarned ?? 0) - Number(selected?.cost_sc ?? 0)).toFixed(2)}</b></p>
            <p>Leaderboard: #{result.leaderboardRank ?? "-"}</p>
            <div className={styles.actions}>
              <button className={styles.primaryBtn} onClick={() => setResult(null)}>Play Again</button>
              <button className={styles.secondaryBtn} onClick={() => setSelected(levels[Math.min(levels.length - 1, (levels.findIndex((x) => x.id === selected?.id) + 1))] ?? selected)}>Next Level</button>
              <Link href="/supanova" className={styles.secondaryBtn}>Back to Arcade</Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
