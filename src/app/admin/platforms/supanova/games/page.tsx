"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import styles from "../page.module.css";

type QuestionDraft = { question: string; options: string[]; correct: number; explanation: string };

export default function AdminGamesPage() {
  const [games, setGames] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "category" | "max_earn_sc">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any | null>(null);
  const [levels, setLevels] = useState<any[]>([]);
  const [editLevel, setEditLevel] = useState<any | null>(null);
  const [newQ, setNewQ] = useState<any>({
    level_number: 1,
    name: "",
    difficulty: "easy",
    is_free: false,
    cost_sc: 5,
    reward_sc: 10,
    time_limit_seconds: 60,
    questions: [] as QuestionDraft[],
  });
  useEffect(() => { fetch("/api/admin/supanova/games", { cache: "no-store" }).then((r) => r.json()).then((j) => setGames(j?.data ?? [])); }, []);
  async function openGame(g: any) {
    setSelected(g);
    const res = await fetch(`/api/admin/supanova/games/${g.id}/levels`, { cache: "no-store" });
    const j = await res.json();
    setLevels(j?.data ?? []);
  }
  function hasInvalidQuestionSet(list: QuestionDraft[]): boolean {
    if (!Array.isArray(list) || list.length === 0) return true;
    return list.some((q) => {
      const hasText = String(q.question ?? "").trim().length > 0;
      const opts = Array.isArray(q.options) ? q.options : [];
      const validOpts = opts.length === 4 && opts.every((x) => String(x ?? "").trim().length > 0);
      const validCorrect = Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3;
      return !(hasText && validOpts && validCorrect);
    });
  }
  const filteredGames = games
    .filter((g) => `${g.name} ${g.category}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      const av = sortBy === "max_earn_sc" ? Number(a?.[sortBy] ?? 0) : String(a?.[sortBy] ?? "").toLowerCase();
      const bv = sortBy === "max_earn_sc" ? Number(b?.[sortBy] ?? 0) : String(b?.[sortBy] ?? "").toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filteredGames.length / pageSize));
  const pagedGames = filteredGames.slice((page - 1) * pageSize, page * pageSize);
  return (
    <main className={styles.page}>
      <h1>Game Management</h1>
      <div className={styles.row}>
        <input className={styles.input} placeholder="Search game/category" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className={styles.select} value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
          <option value="name">Sort: Name</option>
          <option value="category">Sort: Category</option>
          <option value="max_earn_sc">Sort: Max Earn</option>
        </select>
        <select className={styles.select} value={sortDir} onChange={(e) => setSortDir(e.target.value as any)}>
          <option value="asc">ASC</option>
          <option value="desc">DESC</option>
        </select>
      </div>
      <div className={`${styles.tableWrap} ${styles.desktopOnly}`}>
        <table className={styles.table}>
          <thead><tr><th>Icon</th><th>Name</th><th>Category</th><th>Free</th><th>Free Levels</th><th>Cost</th><th>Max Earn</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>{pagedGames.map((g) => <tr key={g.id}><td>{g.icon}</td><td>{g.name}</td><td>{g.category}</td><td>{String(g.is_free)}</td><td>{g.free_levels}</td><td>{g.cost_sc}</td><td>{g.max_earn_sc}</td><td>{String(g.is_active)}</td><td><button className={styles.btnGhost} onClick={() => openGame(g)}>Edit</button></td></tr>)}</tbody>
        </table>
      </div>
      <div className={styles.mobileOnly}>
        {pagedGames.map((g) => (
          <article key={g.id} className={styles.mobileCard}>
            <p><b>{g.icon} {g.name}</b></p>
            <p className={styles.muted}>{g.category} • Max earn {g.max_earn_sc} SC</p>
            <button className={styles.btnGhost} onClick={() => openGame(g)}>Edit</button>
          </article>
        ))}
      </div>
      <div className={styles.pager}>
        <button className={styles.btnGhost} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
        <span className={styles.muted}>Page {page} / {pageCount}</span>
        <button className={styles.btnGhost} disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button>
      </div>
      {selected && (
        <section className={styles.panel}>
          <h3>Edit Game: {selected.name}</h3>
          <div className={styles.formGrid}>
            <input className={styles.input} value={selected.name} onChange={(e) => setSelected({ ...selected, name: e.target.value })} placeholder="Name" />
            <textarea className={styles.textarea} value={selected.description || ""} onChange={(e) => setSelected({ ...selected, description: e.target.value })} placeholder="Description" />
            <div className={styles.row}>
              <input className={styles.input} value={selected.icon || ""} onChange={(e) => setSelected({ ...selected, icon: e.target.value })} placeholder="Icon" />
              <input className={styles.input} value={selected.color || ""} onChange={(e) => setSelected({ ...selected, color: e.target.value })} placeholder="Color" />
              <input className={styles.input} type="number" value={selected.max_earn_sc || 0} onChange={(e) => setSelected({ ...selected, max_earn_sc: Number(e.target.value) })} placeholder="Max Earn SC" />
            </div>
            <div className={styles.row}>
              <label className={styles.pill}><input type="checkbox" checked={!!selected.is_free} onChange={(e) => setSelected({ ...selected, is_free: e.target.checked })} /> Free</label>
              <label className={styles.pill}><input type="checkbox" checked={!!selected.is_active} onChange={(e) => setSelected({ ...selected, is_active: e.target.checked })} /> Active</label>
            </div>
            <button className={styles.btn} onClick={async () => {
              const res = await fetch(`/api/admin/supanova/games/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selected) });
              if (!res.ok) return alert("Save failed");
              setGames((prev) => prev.map((x) => (x.id === selected.id ? { ...x, ...selected } : x)));
              alert("Saved");
            }}>Save Game</button>
          </div>

          <h3>Levels</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>#</th><th>Name</th><th>Difficulty</th><th>Free</th><th>Cost</th><th>Reward</th><th>Questions</th><th>Actions</th></tr></thead>
              <tbody>{levels.map((l) => <tr key={l.id}><td>{l.level_number}</td><td>{l.name}</td><td>{l.difficulty}</td><td>{String(l.is_free)}</td><td>{l.cost_sc}</td><td>{l.reward_sc}</td><td>{l.question_count}</td><td><button className={styles.btnGhost} onClick={() => setEditLevel({ ...l, questions: Array.isArray(l.questions) ? l.questions : [] })}>Edit Level</button></td></tr>)}</tbody>
            </table>
          </div>
          {editLevel && (
            <div className={styles.panel}>
              <h4>Edit Level #{editLevel.level_number}</h4>
              <div className={styles.row}>
                <input className={styles.input} value={editLevel.name || ""} onChange={(e) => setEditLevel({ ...editLevel, name: e.target.value })} placeholder="Name" />
                <select className={styles.select} value={editLevel.difficulty || "easy"} onChange={(e) => setEditLevel({ ...editLevel, difficulty: e.target.value })}>
                  <option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option><option value="expert">expert</option>
                </select>
              </div>
              <div className={styles.row}>
                <button className={styles.btnGhost} onClick={() => setEditLevel((prev: any) => ({ ...prev, questions: [...(prev.questions ?? []), { question: "", options: ["", "", "", ""], correct: 0, explanation: "" }] }))}>+ Question</button>
              </div>
              {(editLevel.questions ?? []).map((qq: any, idx: number) => (
                <div key={idx} className={styles.panel}>
                  <div className={styles.row}>
                    <strong>Q{idx + 1}</strong>
                    <button className={styles.btnGhost} onClick={() => setEditLevel((prev: any) => ({ ...prev, questions: (prev.questions ?? []).filter((_: any, i: number) => i !== idx) }))}>Remove</button>
                  </div>
                  <input className={styles.input} value={qq.question || ""} onChange={(e) => setEditLevel((prev: any) => {
                    const next = [...(prev.questions ?? [])]; next[idx] = { ...next[idx], question: e.target.value }; return { ...prev, questions: next };
                  })} placeholder={`Question text`} />
                  <div className={styles.formGrid}>
                    {[0, 1, 2, 3].map((opt) => (
                      <input
                        key={opt}
                        className={styles.input}
                        placeholder={`Option ${opt + 1}`}
                        value={qq.options?.[opt] ?? ""}
                        onChange={(e) => setEditLevel((prev: any) => {
                          const next = [...(prev.questions ?? [])];
                          const nextOpts = [...(next[idx].options ?? ["", "", "", ""])];
                          nextOpts[opt] = e.target.value;
                          next[idx] = { ...next[idx], options: nextOpts };
                          return { ...prev, questions: next };
                        })}
                      />
                    ))}
                  </div>
                  <div className={styles.row}>
                    <label>Correct</label>
                    <select className={styles.select} value={Number(qq.correct ?? 0)} onChange={(e) => setEditLevel((prev: any) => {
                      const next = [...(prev.questions ?? [])];
                      next[idx] = { ...next[idx], correct: Number(e.target.value) };
                      return { ...prev, questions: next };
                    })}>
                      <option value={0}>Option 1</option>
                      <option value={1}>Option 2</option>
                      <option value={2}>Option 3</option>
                      <option value={3}>Option 4</option>
                    </select>
                  </div>
                  <textarea className={styles.textarea} placeholder="Explanation" value={qq.explanation || ""} onChange={(e) => setEditLevel((prev: any) => {
                    const next = [...(prev.questions ?? [])];
                    next[idx] = { ...next[idx], explanation: e.target.value };
                    return { ...prev, questions: next };
                  })} />
                </div>
              ))}
              <div className={styles.row}>
                <button className={styles.btn} onClick={async () => {
                  if (hasInvalidQuestionSet(editLevel.questions ?? [])) return alert("Each question must include text, 4 options, and valid correct answer.");
                  const res = await fetch(`/api/admin/supanova/games/${selected.id}/levels/${editLevel.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(editLevel),
                  });
                  const j = await res.json();
                  if (!res.ok) return alert(j?.error ?? "Update failed");
                  setLevels((prev) => prev.map((x) => (x.id === editLevel.id ? { ...j.data, question_count: Array.isArray(j.data?.questions) ? j.data.questions.length : 0 } : x)));
                  setEditLevel(null);
                }}>Save Level</button>
                <button className={styles.btnGhost} onClick={() => setEditLevel(null)}>Close</button>
              </div>
            </div>
          )}
          <h4>Add Level</h4>
          <div className={styles.formGrid}>
            <div className={styles.row}>
              <input className={styles.input} type="number" value={newQ.level_number} onChange={(e) => setNewQ({ ...newQ, level_number: Number(e.target.value) })} placeholder="Level #" />
              <input className={styles.input} value={newQ.name} onChange={(e) => setNewQ({ ...newQ, name: e.target.value })} placeholder="Level name" />
              <select className={styles.select} value={newQ.difficulty} onChange={(e) => setNewQ({ ...newQ, difficulty: e.target.value })}>
                <option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option><option value="expert">expert</option>
              </select>
            </div>
            <div className={styles.row}>
              <label className={styles.pill}><input type="checkbox" checked={newQ.is_free} onChange={(e) => setNewQ({ ...newQ, is_free: e.target.checked })} /> Free</label>
              <input className={styles.input} type="number" value={newQ.cost_sc} onChange={(e) => setNewQ({ ...newQ, cost_sc: Number(e.target.value) })} placeholder="Cost SC" />
              <input className={styles.input} type="number" value={newQ.reward_sc} onChange={(e) => setNewQ({ ...newQ, reward_sc: Number(e.target.value) })} placeholder="Reward SC" />
              <input className={styles.input} type="number" value={newQ.time_limit_seconds} onChange={(e) => setNewQ({ ...newQ, time_limit_seconds: Number(e.target.value) })} placeholder="Time sec" />
            </div>
            <div className={styles.panel}>
              <div className={styles.row}>
                <h4>Questions Builder</h4>
                <button
                  className={styles.btnGhost}
                  onClick={() => setNewQ((prev: any) => ({
                    ...prev,
                    questions: [
                      ...(Array.isArray(prev.questions) ? prev.questions : []),
                      { question: "", options: ["", "", "", ""], correct: 0, explanation: "" },
                    ],
                  }))}
                >
                  + Add Question
                </button>
              </div>
              {(Array.isArray(newQ.questions) ? newQ.questions : []).map((q: QuestionDraft, idx: number) => (
                <div key={idx} className={styles.panel}>
                  <div className={styles.row}>
                    <strong>Q{idx + 1}</strong>
                    <button className={styles.btnGhost} onClick={() => setNewQ((prev: any) => ({ ...prev, questions: prev.questions.filter((_: any, i: number) => i !== idx) }))}>Remove</button>
                  </div>
                  <input
                    className={styles.input}
                    placeholder="Question text"
                    value={q.question}
                    onChange={(e) => setNewQ((prev: any) => {
                      const next = [...prev.questions];
                      next[idx] = { ...next[idx], question: e.target.value };
                      return { ...prev, questions: next };
                    })}
                  />
                  <div className={styles.formGrid}>
                    {[0, 1, 2, 3].map((opt) => (
                      <input
                        key={opt}
                        className={styles.input}
                        placeholder={`Option ${opt + 1}`}
                        value={q.options?.[opt] ?? ""}
                        onChange={(e) => setNewQ((prev: any) => {
                          const next = [...prev.questions];
                          const nextOpts = [...(next[idx].options ?? ["", "", "", ""])];
                          nextOpts[opt] = e.target.value;
                          next[idx] = { ...next[idx], options: nextOpts };
                          return { ...prev, questions: next };
                        })}
                      />
                    ))}
                  </div>
                  <div className={styles.row}>
                    <label>Correct Answer</label>
                    <select
                      className={styles.select}
                      value={q.correct}
                      onChange={(e) => setNewQ((prev: any) => {
                        const next = [...prev.questions];
                        next[idx] = { ...next[idx], correct: Number(e.target.value) };
                        return { ...prev, questions: next };
                      })}
                    >
                      <option value={0}>Option 1</option>
                      <option value={1}>Option 2</option>
                      <option value={2}>Option 3</option>
                      <option value={3}>Option 4</option>
                    </select>
                  </div>
                  <textarea
                    className={styles.textarea}
                    placeholder="Explanation"
                    value={q.explanation}
                    onChange={(e) => setNewQ((prev: any) => {
                      const next = [...prev.questions];
                      next[idx] = { ...next[idx], explanation: e.target.value };
                      return { ...prev, questions: next };
                    })}
                  />
                </div>
              ))}
              <p className={styles.muted}>Total questions: {(newQ.questions ?? []).length}</p>
            </div>
            <button className={styles.btn} onClick={async () => {
              if (hasInvalidQuestionSet(newQ.questions ?? [])) return alert("Each question must include text, 4 options, and valid correct answer.");
              const res = await fetch(`/api/admin/supanova/games/${selected.id}/levels`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newQ) });
              const j = await res.json();
              if (!res.ok) return alert(j?.error ?? "Create level failed");
              setLevels((prev) => [...prev, { ...j.data, question_count: Array.isArray(j.data?.questions) ? j.data.questions.length : 0 }]);
              alert("Level added");
            }}>Add Level</button>
          </div>
        </section>
      )}
    </main>
  );
}
