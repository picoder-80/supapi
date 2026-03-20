"use client";
import { useMemo, useState } from "react";
import styles from "./game.module.css";

export default function MemoryFlip({ level, onComplete }: { level: any; onComplete: (score: number, timeTaken: number) => void }) {
  const size = String(level?.difficulty ?? "easy") === "hard" ? 10 : String(level?.difficulty ?? "easy") === "medium" ? 8 : 6;
  const base = "ABCDEFGHIJ".slice(0, size).split("");
  const deck = useMemo(() => [...base, ...base].sort(() => Math.random() - 0.5), [size]);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [start] = useState(Date.now());
  function click(idx: number) {
    if (open.includes(idx) || matched.includes(idx) || open.length === 2) return;
    const next = [...open, idx];
    setOpen(next);
    if (next.length === 2) {
      setAttempts((v) => v + 1);
      if (deck[next[0]] === deck[next[1]]) {
        const all = [...matched, ...next];
        setMatched(all);
        setOpen([]);
        if (all.length === deck.length) {
          const score = Math.max(0, Math.round((all.length / deck.length) * 1000 - (attempts + 1) * 5));
          onComplete(score, Math.floor((Date.now() - start) / 1000));
        }
      } else setTimeout(() => setOpen([]), 800);
    }
  }
  return (
    <div className={styles.wrap}>
      <h3>Memory Flip</h3>
      <div className={styles.gridCards}>
        {deck.map((x, idx) => (
          <button className={styles.card} key={idx} onClick={() => click(idx)}>{open.includes(idx) || matched.includes(idx) ? x : "?"}</button>
        ))}
      </div>
      <p>Matched pairs: {matched.length / 2}</p>
    </div>
  );
}
