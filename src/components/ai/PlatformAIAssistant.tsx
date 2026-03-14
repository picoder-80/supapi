"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./PlatformAIAssistant.module.css";

type AssistantMode = "assistant" | "growth" | "support" | "ops";
type MemoryItem = {
  platform: string;
  mode: AssistantMode;
  q: string;
  a: string;
  provider: string;
  ts: string;
};

const AI_MEMORY_KEY = "supapi_ai_memory_v1";
const AI_MEMORY_LIMIT = 5;

function platformFromPath(pathname: string): string {
  if (!pathname || pathname === "/") return "home";
  const clean = pathname.replace(/^\/+/, "").split("/")[0]?.toLowerCase() ?? "home";
  if (!clean) return "home";
  if (clean === "admin") return "home";
  return clean;
}

function token() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("supapi_token") ?? "";
}

export default function PlatformAIAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [provider, setProvider] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<AssistantMode>("assistant");
  const [modes, setModes] = useState<AssistantMode[]>(["assistant", "growth", "support", "ops"]);
  const [quickPromptsMap, setQuickPromptsMap] = useState<Record<string, string[]>>({});
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [memory, setMemory] = useState<MemoryItem[]>([]);

  const platform = useMemo(() => platformFromPath(pathname), [pathname]);
  const quickPromptKey = `${platform}:${mode}`;
  const quickPrompts = quickPromptsMap[quickPromptKey] ?? [
    "How to start step-by-step on this platform?",
    "Show me common mistakes to avoid",
    "Give a quick quality checklist",
  ];

  if (pathname.startsWith("/admin")) return null;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AI_MEMORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setMemory(
          parsed
            .map((m: any) => ({
              platform: String(m?.platform ?? ""),
              mode: String(m?.mode ?? "assistant") as AssistantMode,
              q: String(m?.q ?? ""),
              a: String(m?.a ?? ""),
              provider: String(m?.provider ?? ""),
              ts: String(m?.ts ?? ""),
            }))
            .filter((m: MemoryItem) => m.platform && m.q && m.a)
            .slice(0, AI_MEMORY_LIMIT),
        );
      }
    } catch {
      setMemory([]);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(AI_MEMORY_KEY, JSON.stringify(memory.slice(0, AI_MEMORY_LIMIT)));
    } catch {
      // ignore storage errors
    }
  }, [memory]);

  useEffect(() => {
    if (!open || statusLoaded) return;
    const loadStatus = async () => {
      try {
        const auth = token();
        const r = await fetch("/api/ai/assist", {
          headers: auth ? { Authorization: `Bearer ${auth}` } : {},
        });
        const d = await r.json();
        const entries = Array.isArray(d?.data?.platforms) ? d.data.platforms : [];
        const availableModes = Array.isArray(d?.data?.modes) ? d.data.modes.map(String) : [];
        if (availableModes.length) setModes(availableModes as AssistantMode[]);
        const map: Record<string, string[]> = {};
        entries.forEach((entry: any) => {
          const key = String(entry?.platform ?? "");
          const prompts = Array.isArray(entry?.quick_prompts) ? entry.quick_prompts.map(String) : [];
          if (key) map[`${key}:assistant`] = prompts;
        });
        setQuickPromptsMap(map);

        const serverMemory = Array.isArray(d?.data?.recent_memory) ? d.data.recent_memory : [];
        if (serverMemory.length) {
          const normalized: MemoryItem[] = serverMemory
            .map((m: any) => ({
              platform: String(m?.platform ?? ""),
              mode: String(m?.mode ?? "assistant") as AssistantMode,
              q: String(m?.question ?? ""),
              a: String(m?.answer ?? ""),
              provider: String(m?.provider ?? ""),
              ts: String(m?.created_at ?? new Date().toISOString()),
            }))
            .filter((m: MemoryItem) => m.platform && m.q && m.a)
            .slice(0, AI_MEMORY_LIMIT);
          if (normalized.length) setMemory(normalized);
        }
      } catch {
        // keep local fallback prompts
      } finally {
        setStatusLoaded(true);
      }
    };
    loadStatus();
  }, [open, statusLoaded]);

  const ask = async () => {
    const trimmed = message.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError("");
    const scopedMemory = memory
      .filter((m) => m.platform === platform && m.mode === mode)
      .slice(0, AI_MEMORY_LIMIT);
    const memoryContext = scopedMemory
      .map((m, idx) => `#${idx + 1} Q:${m.q}\nA:${m.a}`)
      .join("\n\n");
    try {
      const auth = token();
      const r = await fetch("/api/ai/assist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        },
        body: JSON.stringify({
          platform,
          mode,
          message: trimmed,
          context: `pathname:${pathname}\nrecent_memory:\n${memoryContext || "none"}`,
        }),
      });
      const d = await r.json();
      if (!d?.success) {
        setError(d?.error ?? "Assistant failed");
      } else {
        const nextAnswer = String(d?.data?.answer ?? "");
        const nextProvider = String(d?.data?.provider ?? "");
        setAnswer(nextAnswer);
        setSuggestions(Array.isArray(d?.data?.suggestions) ? d.data.suggestions.map(String) : []);
        const serverPrompts = Array.isArray(d?.data?.quick_prompts) ? d.data.quick_prompts.map(String) : null;
        if (serverPrompts?.length) {
          setQuickPromptsMap((prev) => ({ ...prev, [`${platform}:${mode}`]: serverPrompts }));
        }
        setProvider(nextProvider);
        const serverMemory = Array.isArray(d?.data?.recent_memory) ? d.data.recent_memory : null;
        if (serverMemory?.length) {
          setMemory(
            serverMemory
              .map((m: any) => ({
                platform: String(m?.platform ?? ""),
                mode: String(m?.mode ?? "assistant") as AssistantMode,
                q: String(m?.question ?? ""),
                a: String(m?.answer ?? ""),
                provider: String(m?.provider ?? ""),
                ts: String(m?.created_at ?? new Date().toISOString()),
              }))
              .filter((m: MemoryItem) => m.platform && m.q && m.a)
              .slice(0, AI_MEMORY_LIMIT),
          );
        } else {
          setMemory((prev) => [
            {
              platform,
              mode,
              q: trimmed,
              a: nextAnswer,
              provider: nextProvider,
              ts: new Date().toISOString(),
            },
            ...prev,
          ].slice(0, AI_MEMORY_LIMIT));
        }
      }
    } catch {
      setError("Assistant failed");
    } finally {
      setLoading(false);
    }
  };

  const clearMemory = () => {
    setMemory([]);
    try {
      localStorage.removeItem(AI_MEMORY_KEY);
    } catch {
      // ignore storage errors
    }
    const auth = token();
    if (auth) {
      fetch("/api/ai/assist", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth}` },
      }).catch(() => {});
    }
  };

  const recentMemory = memory.filter((m) => m.platform === platform && m.mode === mode).slice(0, 3);

  return (
    <>
      <button className={styles.fab} onClick={() => setOpen((v) => !v)} aria-label="Open AI assistant">
        🤖 AI
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.head}>
            <div>
              <div className={styles.title}>Supapi AI Assistant</div>
              <div className={styles.sub}>Platform: {platform} · mode: {mode}</div>
            </div>
            <button className={styles.closeBtn} onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>

          <div className={styles.modeRow}>
            {modes.map((m) => (
              <button
                key={m}
                className={`${styles.modeBtn} ${mode === m ? styles.modeBtnActive : ""}`}
                onClick={() => setMode(m)}
              >
                {m}
              </button>
            ))}
          </div>

          <div className={styles.quickRow}>
            {quickPrompts.slice(0, 3).map((prompt) => (
              <button
                key={prompt}
                className={styles.quickChip}
                onClick={() => setMessage(prompt)}
              >
                {prompt}
              </button>
            ))}
            {!!memory.length && (
              <button className={styles.memoryClearBtn} onClick={clearMemory}>
                Clear memory
              </button>
            )}
          </div>

          <textarea
            className={styles.input}
            placeholder="Ask anything about this platform flow..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <button className={styles.askBtn} onClick={ask} disabled={loading || !message.trim()}>
            {loading ? "Thinking..." : "Ask AI"}
          </button>

          {!!error && <div className={styles.error}>❌ {error}</div>}

          {!!answer && (
            <div className={styles.result}>
              <div className={styles.answer}>{answer}</div>
              {suggestions.length > 0 && (
                <div className={styles.suggestions}>
                  {suggestions.map((s) => (
                    <button key={s} className={styles.suggestionChip} onClick={() => setMessage(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {!!provider && <div className={styles.provider}>Provider: {provider}</div>}
            </div>
          )}

          {recentMemory.length > 0 && (
            <div className={styles.memoryBox}>
              <div className={styles.memoryTitle}>Recent memory</div>
              {recentMemory.map((m) => (
                <button
                  key={`${m.ts}-${m.q}`}
                  className={styles.memoryItem}
                  onClick={() => setMessage(m.q)}
                >
                  {m.q}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
