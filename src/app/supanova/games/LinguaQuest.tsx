"use client";
import { useState } from "react";
import styles from "./game.module.css";

const rounds = [
  { q: "Hello (Malay)", a: "Halo", opts: ["Bonjour", "Hola", "Halo", "Konnichiwa"] },
  { q: "Thank you (Spanish)", a: "Gracias", opts: ["Arigato", "Gracias", "Merci", "Xie Xie"] },
  { q: "Water (French)", a: "Eau", opts: ["Agua", "Mizu", "Eau", "Air"] },
  { q: "Book (Japanese)", a: "Hon", opts: ["Libro", "Hon", "Shu", "Kitab"] },
  { q: "Peace (Arabic)", a: "Salam", opts: ["Salam", "Paix", "Paz", "Heiwa"] },
];

export default function LinguaQuest({ onComplete }: { level: any; onComplete: (score: number, timeTaken: number) => void }) {
  const [pair, setPair] = useState("English ↔ Malay");
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [start] = useState(Date.now());
  const cur = rounds[i];
  return (
    <div className={styles.wrap}>
      <h3>LinguaQuest</h3>
      <div className={styles.chipRow}>
        {["English ↔ Malay", "English ↔ Mandarin", "English ↔ Japanese", "English ↔ Spanish", "English ↔ French", "English ↔ Arabic"].map((x) => (
          <button key={x} className={pair === x ? styles.chipActive : styles.chip} onClick={() => setPair(x)}>{x}</button>
        ))}
      </div>
      <p className={styles.mini}>Pair: {pair}</p>
      <p>{cur.q}</p>
      {cur.opts.map((o) => (
        <button className={styles.btn} key={o} onClick={() => {
          const next = score + (o === cur.a ? 100 : 0);
          if (i + 1 >= rounds.length) onComplete(next, Math.floor((Date.now() - start) / 1000));
          else { setScore(next); setI(i + 1); }
        }}>{o}</button>
      ))}
      <p>Score: {score}</p>
    </div>
  );
}
