"use client";
import { useMemo, useState } from "react";
import styles from "./game.module.css";

export default function GeoWiz({ onComplete }: { level: any; onComplete: (score: number, timeTaken: number) => void }) {
  const q = useMemo(() => ([
    { q: "🇲🇾 is flag of?", o: ["Indonesia", "Malaysia", "Thailand", "Brunei"], a: 1 },
    { q: "Capital of France?", o: ["Berlin", "Rome", "Paris", "Madrid"], a: 2 },
    { q: "Hottest planet?", o: ["Mars", "Venus", "Mercury", "Jupiter"], a: 1 },
    { q: "True/False: Nile is in Africa", o: ["True", "False"], a: 0 },
    { q: "Capital of Canada?", o: ["Toronto", "Vancouver", "Ottawa", "Montreal"], a: 2 },
    { q: "Largest desert?", o: ["Sahara", "Gobi", "Arctic", "Kalahari"], a: 0 },
    { q: "Element with symbol O?", o: ["Gold", "Oxygen", "Osmium", "Silver"], a: 1 },
    { q: "True/False: Earth has 2 moons", o: ["True", "False"], a: 1 },
  ]), []);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [start] = useState(Date.now());
  const cur = q[i];
  return (
    <div className={styles.wrap}>
      <p>{cur.q}</p>
      {cur.o.map((o, idx) => (
        <button className={styles.btn} key={o} onClick={() => {
          const next = score + (idx === cur.a ? 120 : 0);
          if (i + 1 >= q.length) onComplete(next, Math.floor((Date.now() - start) / 1000));
          else { setScore(next); setI(i + 1); }
        }}>{o}</button>
      ))}
      <p>Score {score}</p>
    </div>
  );
}
