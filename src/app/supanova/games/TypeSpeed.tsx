"use client";
import { useEffect, useMemo, useState } from "react";
import styles from "./game.module.css";

export default function TypeSpeed({ onComplete }: { level: any; onComplete: (score: number, timeTaken: number) => void }) {
  const text = useMemo(() => "Typing practice improves focus and productivity. Consistency beats intensity.", []);
  const [input, setInput] = useState("");
  const [left, setLeft] = useState(60);
  const [start] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setLeft((v) => v - 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (left <= 0) {
    const words = input.trim().split(/\s+/).filter(Boolean).length;
    const wpm = words;
    const correct = [...input].filter((c, i) => c === text[i]).length;
    const accuracy = text.length ? correct / text.length : 0;
    onComplete(Math.round(wpm * accuracy * 100), Math.floor((Date.now() - start) / 1000));
    return null;
  }
  return (
    <div className={styles.wrap}>
      <p>{text}</p>
      <textarea className={styles.textarea} value={input} onChange={(e) => setInput(e.target.value)} />
      <p>Time left: {left}s</p>
      <p className={styles.mini}>
        {input.split("").slice(0, 50).map((c, i) => (c === text[i] ? "✓" : "✗")).join(" ")}
      </p>
    </div>
  );
}
