"use client";
import { useMemo, useState } from "react";
import styles from "./game.module.css";

export default function CodeBreaker({ onComplete }: { level: any; onComplete: (score: number, timeTaken: number) => void }) {
  const puzzle = useMemo(() => ([
    { q: "2,4,8,16, ?", o: ["18", "24", "32", "20"], a: 2 },
    { q: "If A=1 B=2, A+B*2=?", o: ["6", "5", "4", "3"], a: 1 },
    { q: "Output of: let x=2; x+=3;", o: ["2", "3", "5", "23"], a: 2 },
    { q: "Which has error? const a=1; a=2;", o: ["Line 1", "Line 2", "Both", "None"], a: 1 },
    { q: "1,1,2,3,5,8, ?", o: ["11", "13", "15", "10"], a: 1 },
    { q: "if (true && false) => ?", o: ["true", "false", "null", "error"], a: 1 },
    { q: "Array index starts at?", o: ["1", "0", "-1", "depends"], a: 1 },
    { q: "Bug line? for(i=0;i<=arr.length;i++)", o: ["i=0", "i<=arr.length", "i++", "none"], a: 1 },
  ]), []);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [start] = useState(Date.now());
  const cur = puzzle[i];
  return (
    <div className={styles.wrap}>
      <h3>CodeBreaker</h3>
      <p>{cur.q}</p>
      {cur.o.map((o, idx) => (
        <button className={styles.btn} key={o} onClick={() => {
          const next = score + (idx === cur.a ? 150 : 0);
          if (i + 1 >= puzzle.length) onComplete(next, Math.floor((Date.now() - start) / 1000));
          else { setScore(next); setI(i + 1); }
        }}>{o}</button>
      ))}
      <p>Score {score}</p>
    </div>
  );
}
