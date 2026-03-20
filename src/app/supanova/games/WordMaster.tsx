"use client";
import { useMemo, useState } from "react";
import styles from "./game.module.css";

export default function WordMaster({ onComplete }: { level: any; onComplete: (score: number, timeTaken: number) => void }) {
  const rounds = useMemo(
    () => [
      { mode: "spell", prompt: "A large amount", ans: "abundant" },
      { mode: "define", prompt: "resilient", ans: "Able to recover quickly" },
      { mode: "fill", prompt: "Knowledge is _____.", ans: "power" },
      { mode: "spell", prompt: "Eager to know", ans: "curious" },
      { mode: "define", prompt: "vivid", ans: "Very clear and detailed" },
      { mode: "fill", prompt: "Practice makes _____.", ans: "perfect" },
      { mode: "spell", prompt: "Hard-working", ans: "diligent" },
      { mode: "define", prompt: "clarity", ans: "State of being clear" },
      { mode: "fill", prompt: "Time is _____.", ans: "gold" },
      { mode: "spell", prompt: "A trip from one place to another", ans: "journey" },
    ],
    []
  );
  const [i, setI] = useState(0);
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [start] = useState(Date.now());
  const answer = rounds[i];
  const speedBonus = Math.max(1, 11 - (i + 1));
  return (
    <div className={styles.wrap}>
      <h3>Spell It</h3>
      <p>
        {answer.mode === "spell" && <>Spell this word: <b>{answer.prompt}</b></>}
        {answer.mode === "define" && <>Pick definition for: <b>{answer.prompt}</b></>}
        {answer.mode === "fill" && <>Fill in blank: <b>{answer.prompt}</b></>}
      </p>
      <input className={styles.input} value={input} onChange={(e) => setInput(e.target.value)} autoFocus />
      <button onClick={() => {
        const ok = input.trim().toLowerCase() === String(answer.ans).toLowerCase();
        setFeedback(ok ? "Correct" : `Wrong. Correct: ${answer.ans}`);
        const nextScore = score + (ok ? 10 * speedBonus : 0);
        setTimeout(() => {
          if (i + 1 >= rounds.length) onComplete(nextScore * 10, Math.floor((Date.now() - start) / 1000));
          else { setScore(nextScore); setI(i + 1); setInput(""); setFeedback(""); }
        }, 600);
      }}>Submit</button>
      <p>{feedback}</p>
      <p className={styles.score}>Round {i + 1}/10 • Score {score * 10}</p>
    </div>
  );
}
