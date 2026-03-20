"use client";
import { useEffect, useState } from "react";
import styles from "./game.module.css";

function q(diff: string) {
  if (diff === "medium") {
    const a = Math.floor(Math.random() * 12) + 1;
    const b = Math.floor(Math.random() * 12) + 1;
    return { text: `${a} × ${b}`, ans: a * b };
  }
  if (diff === "hard") {
    const pct = [10, 20, 25, 50][Math.floor(Math.random() * 4)];
    const base = [40, 60, 80, 120][Math.floor(Math.random() * 4)];
    return { text: `${pct}% of ${base}`, ans: (pct / 100) * base };
  }
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  return Math.random() > 0.5 ? { text: `${a} + ${b}`, ans: a + b } : { text: `${a + b} - ${b}`, ans: a };
}

export default function MathRush({ level, onComplete }: { level: any; onComplete: (score: number, timeTaken: number) => void }) {
  const difficulty = String(level?.difficulty ?? "easy");
  const [cur, setCur] = useState(q(difficulty));
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(90);
  const [streak, setStreak] = useState(0);
  const [start] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setLeft((v) => v - 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (left <= 0) {
    onComplete(score, Math.floor((Date.now() - start) / 1000));
    return null;
  }
  return (
    <div className={styles.wrap}>
      <h3>Time left: {left}s</h3>
      <p className={styles.question}>{cur.text} = ?</p>
      <input className={styles.input} value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={() => {
        const ok = Number(input) === cur.ans;
        const nextStreak = ok ? streak + 1 : 0;
        setStreak(nextStreak);
        setScore((s) => s + (ok ? Math.round(100 * (1 + nextStreak * 0.1)) : 0));
        setInput("");
        setCur(q(difficulty));
      }}>Enter</button>
      <p>Streak: {streak}</p>
      <p className={styles.score}>Score: {score}</p>
    </div>
  );
}
