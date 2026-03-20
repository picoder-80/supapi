"use client";
import { useEffect, useMemo, useState } from "react";
import styles from "./game.module.css";

export default function BrainQuiz({ onComplete }: { level: any; onComplete: (score: number, timeTaken: number) => void }) {
  const questions = useMemo(() => ([
    { q: "Capital of Japan?", o: ["Seoul", "Tokyo", "Kyoto", "Osaka"], c: 1, e: "Tokyo is the current capital city." },
    { q: "H2O is?", o: ["Oxygen", "Hydrogen", "Water", "Salt"], c: 2, e: "H2O is the chemical formula for water." },
    { q: "Largest planet?", o: ["Earth", "Jupiter", "Mars", "Saturn"], c: 1, e: "Jupiter is the largest planet in our solar system." },
    { q: "Pi ~ ?", o: ["2.14", "3.14", "4.13", "3.41"], c: 1, e: "Pi is approximately 3.14159." },
    { q: "Fastest land animal?", o: ["Lion", "Tiger", "Cheetah", "Horse"], c: 2, e: "Cheetah can reach top speed over 100 km/h." },
    { q: "7*8=?", o: ["54", "56", "58", "64"], c: 1, e: "7 multiplied by 8 equals 56." },
    { q: "HTML stands for?", o: ["Hyper Text Markup Language", "High Text Machine Language", "Hyper Tool Markup Link", "Home Tool Markup"], c: 0, e: "HTML means HyperText Markup Language." },
    { q: "World's largest ocean?", o: ["Indian", "Atlantic", "Arctic", "Pacific"], c: 3, e: "The Pacific Ocean is the largest." },
    { q: "Who wrote Hamlet?", o: ["Shakespeare", "Tolstoy", "Hemingway", "Orwell"], c: 0, e: "Hamlet was written by William Shakespeare." },
    { q: "Main gas in air?", o: ["Oxygen", "Nitrogen", "CO2", "Hydrogen"], c: 1, e: "Earth's atmosphere is mostly nitrogen." },
  ]), []);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [start] = useState(Date.now());
  const [left, setLeft] = useState(60);
  const [picked, setPicked] = useState<number | null>(null);
  const cur = questions[i];
  useEffect(() => {
    const t = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [i]);
  useEffect(() => {
    if (left > 0) return;
    if (i + 1 >= questions.length) onComplete(score, Math.floor((Date.now() - start) / 1000));
    else { setI(i + 1); setLeft(60); }
  }, [left, i, questions.length, onComplete, score, start]);
  return (
    <div className={styles.wrap}>
      <div className={styles.top}>
        <p>Question {i + 1} / {questions.length}</p>
        <p className={styles.score}>Score: {score}</p>
      </div>
      <div className={styles.progress}><div className={styles.progressFill} style={{ width: `${((i + 1) / questions.length) * 100}%` }} /></div>
      <div className={styles.progress}><div className={styles.timerFill} style={{ width: `${(left / 60) * 100}%` }} /></div>
      <h3 className={styles.question}>{cur.q}</h3>
      <div className={styles.options}>
        {cur.o.map((x, idx) => (
          <button
            key={x}
            className={`${styles.btn} ${picked === idx ? (idx === cur.c ? styles.btnOk : styles.btnBad) : ""}`}
            onClick={() => {
              if (picked !== null) return;
              setPicked(idx);
              const add = idx === cur.c ? 100 : 0;
              const nextScore = score + add;
              setTimeout(() => {
                if (i + 1 >= questions.length) onComplete(nextScore, Math.floor((Date.now() - start) / 1000));
                else {
                  setScore(nextScore);
                  setI(i + 1);
                  setLeft(60);
                  setPicked(null);
                }
              }, 900);
            }}
          >
            {String.fromCharCode(65 + idx)}. {x}
          </button>
        ))}
      </div>
      {picked !== null && <p className={styles.mini}>{cur.e}</p>}
    </div>
  );
}
