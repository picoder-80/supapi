"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./page.module.css";

type AssistMode = { key: string; label: string; description?: string };
type AssistMemory = { platform: string; mode: string; question: string; answer: string; created_at: string };
type ChatMessage = { id: string; role: "user" | "assistant"; text: string; meta?: string };
type Subscription = { status?: string; plan?: { code?: string; name?: string } | null };
type ChatSession = { id: string; title: string; updated_at: string; messages: ChatMessage[] };
type Entitlement = {
  plan_code?: string;
  monthly_limit?: number;
  used?: number;
  remaining?: number;
  topup_remaining?: number;
};

function toPlanLabel(code?: string): string {
  const v = String(code ?? "").trim().toLowerCase();
  if (v === "pro_monthly") return "Pro Monthly";
  if (v === "power_monthly") return "Power Monthly";
  if (v === "free") return "Free";
  return v ? v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "-";
}

export default function SupaMindsChatPage() {
  const { user } = useAuth();
  const [assistModes] = useState<AssistMode[]>([{ key: "assistant", label: "Assistant" }]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [sendingPrompt, setSendingPrompt] = useState(false);
  const [clearingMemory, setClearingMemory] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [chatError, setChatError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [archivedSessions, setArchivedSessions] = useState<ChatSession[]>([]);
  const [sessionQuery, setSessionQuery] = useState("");
  const threadRef = useRef<HTMLDivElement | null>(null);
  const token = useMemo(() => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : ""), []);
  const filteredSessions = useMemo(() => {
    const q = sessionQuery.trim().toLowerCase();
    if (!q) return archivedSessions;
    return archivedSessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [archivedSessions, sessionQuery]);

  const loadAssistMeta = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/ai/assist", { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json().catch(() => ({}));
      if (!d?.success) return;
      const recent = (d.data?.recent_memory ?? []) as AssistMemory[];
      const seed: ChatMessage[] = [];
      for (const m of recent.slice().reverse()) {
        seed.push({ id: `${m.created_at}-q`, role: "user", text: m.question, meta: m.mode });
        seed.push({ id: `${m.created_at}-a`, role: "assistant", text: m.answer, meta: m.platform });
      }
      setChatMessages(seed.slice(-10));
    } catch {}
  }, [token]);

  useEffect(() => { void loadAssistMeta(); }, [loadAssistMeta]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("supaminds_chat_sessions_v1");
      if (!raw) return;
      const parsed = JSON.parse(raw) as ChatSession[];
      if (Array.isArray(parsed)) {
        setArchivedSessions(parsed.filter((s) => s && s.id && Array.isArray(s.messages)).slice(0, 20));
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("supaminds_chat_sessions_v1", JSON.stringify(archivedSessions.slice(0, 20)));
    } catch {}
  }, [archivedSessions]);
  useEffect(() => {
    const loadSub = async () => {
      if (!token) return;
      try {
        const r = await fetch("/api/supaminds/subscription", { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json().catch(() => ({}));
        if (d?.success) setSubscription(d.data?.subscription ?? null);
      } catch {}
    };
    void loadSub();
  }, [token]);
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [chatMessages, sendingPrompt]);

  const hasChatAccess = Boolean(user && token);

  const sendPrompt = async (value?: string) => {
    const text = String(value ?? prompt).trim();
    if (!token || !text || sendingPrompt || !hasChatAccess) return;
    setChatError("");
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text, meta: "assistant" };
    setChatMessages((prev) => [...prev, userMsg]);
    setPrompt("");
    setSendingPrompt(true);
    try {
      const r = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          platform: "home",
          mode: "assistant",
          message: text,
          context: `channel:supaminds-chat;plan:${subscription?.plan?.code ?? "free"}`,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!d?.success) {
        if (d?.data?.entitlement) setEntitlement(d.data.entitlement as Entitlement);
        setChatError(String(d?.error ?? "Assistant request failed."));
        setChatMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", text: d?.error ?? "Assistant request failed." }]);
      } else {
        if (d?.data?.entitlement) setEntitlement(d.data.entitlement as Entitlement);
        setChatMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: String(d?.data?.answer ?? "").trim() || "No response returned.",
            meta: String(d?.data?.provider ?? ""),
          },
        ]);
      }
    } catch {
      setChatError("Network error while contacting assistant.");
      setChatMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", text: "Network error while contacting assistant." }]);
    }
    setSendingPrompt(false);
  };

  const regenerateLast = async () => {
    if (sendingPrompt) return;
    for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
      if (chatMessages[i]?.role === "user") {
        await sendPrompt(chatMessages[i].text);
        return;
      }
    }
  };

  const copyReply = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(""), 1200);
    } catch {}
  };

  const archiveCurrentChat = () => {
    if (!chatMessages.length) return;
    const firstUser = chatMessages.find((m) => m.role === "user")?.text ?? chatMessages[0]?.text ?? "New chat";
    const title = String(firstUser).trim().slice(0, 44) || "New chat";
    const session: ChatSession = {
      id: `s-${Date.now()}`,
      title,
      updated_at: new Date().toISOString(),
      messages: chatMessages.slice(-80),
    };
    setArchivedSessions((prev) => [session, ...prev].slice(0, 20));
  };

  const startNewChat = () => {
    archiveCurrentChat();
    setChatMessages([]);
    setChatError("");
  };

  const openArchivedSession = (session: ChatSession) => {
    setChatMessages(session.messages ?? []);
    setChatError("");
  };

  const deleteArchivedSession = (id: string) => {
    setArchivedSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const renameArchivedSession = (id: string) => {
    const current = archivedSessions.find((s) => s.id === id);
    if (!current) return;
    const nextTitle = window.prompt("Rename chat title", current.title)?.trim();
    if (!nextTitle) return;
    setArchivedSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: nextTitle.slice(0, 60), updated_at: new Date().toISOString() } : s))
    );
  };

  const clearMemory = async () => {
    if (!token || clearingMemory) return;
    setClearingMemory(true);
    try {
      const r = await fetch("/api/ai/assist", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json().catch(() => ({}));
      if (d?.success) setChatMessages([]);
    } catch {}
    setClearingMemory(false);
  };

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.card}>
            <h1 className={styles.title}>SupaMinds Chat</h1>
            <p className={styles.sub}>Please sign in to start prompting SupaMinds.</p>
            <Link href="/dashboard" className={styles.backBtn}>Sign in with Pi</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <button type="button" className={styles.newChatBtn} onClick={startNewChat}>
              + New chat
            </button>
            <input
              className={styles.sessionSearch}
              placeholder="Search chats..."
              value={sessionQuery}
              onChange={(e) => setSessionQuery(e.target.value)}
            />
            <div className={styles.sessionList}>
              {filteredSessions.length ? (
                filteredSessions.map((s) => (
                  <div key={s.id} className={styles.sessionRow}>
                    <button type="button" className={styles.sessionBtn} onClick={() => openArchivedSession(s)}>
                      <span className={styles.sessionTitle}>{s.title}</span>
                      <span className={styles.sessionTime}>{new Date(s.updated_at).toLocaleString()}</span>
                    </button>
                    <div className={styles.sessionActions}>
                      <button type="button" className={styles.tinyBtn} onClick={() => renameArchivedSession(s.id)}>Rename</button>
                      <button type="button" className={styles.tinyBtnDanger} onClick={() => deleteArchivedSession(s.id)}>Delete</button>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.sessionEmpty}>
                  {archivedSessions.length ? "No chats match your search." : "No saved chat history yet."}
                </div>
              )}
            </div>
          </aside>
          <div className={styles.card}>
          <div className={styles.headerRow}>
            <div>
              <h1 className={styles.title}>SupaMinds Chat</h1>
              <p className={styles.sub}>Ask anything. Get fast, useful answers.</p>
            </div>
          </div>

          {!hasChatAccess && (
            <div className={styles.paywall}>
              <strong>Sign in required.</strong> Free plan includes 12 prompts/month. Upgrade for higher limits.
              <Link href="/supaminds" className={styles.backBtn} style={{ marginLeft: 8 }}>View plans</Link>
            </div>
          )}

          <div className={styles.toolbar}>
            <Link href="/supaminds" className={styles.backBtn}>Back to Plans</Link>
            <button className={styles.ghostBtn} onClick={() => void clearMemory()} disabled={clearingMemory}>
              {clearingMemory ? "Clearing..." : "Clear chat memory"}
            </button>
          </div>
          {entitlement && (
            <div className={styles.usagePill}>
              Plan: {toPlanLabel(entitlement.plan_code)} · Used: {Number(entitlement.used ?? 0)} / {Number(entitlement.monthly_limit ?? 0)} · Remaining: {Number(entitlement.remaining ?? 0)} · Topup: {Number(entitlement.topup_remaining ?? 0)}
            </div>
          )}
          {chatError ? <div className={styles.errorMsg}>{chatError}</div> : null}

          <div ref={threadRef} className={styles.chatThread}>
            {!chatMessages.length ? (
              <div className={styles.chatEmpty}>Start by typing a prompt below.</div>
            ) : (
              chatMessages.map((m) => (
                <div key={m.id} className={`${styles.chatBubble} ${m.role === "user" ? styles.chatUser : styles.chatAssistant}`}>
                  <div className={styles.chatRole}>{m.role === "user" ? "You" : "SupaMinds"}</div>
                  <div className={styles.chatText}>{m.text}</div>
                  {m.role === "assistant" && (
                    <div className={styles.chatActions}>
                      <button
                        type="button"
                        className={styles.smallGhostBtn}
                        onClick={() => void copyReply(m.id, m.text)}
                      >
                        {copiedId === m.id ? "Copied" : "Copy"}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            {sendingPrompt && <div className={styles.chatTyping}>SupaMinds is thinking...</div>}
          </div>

          <div className={styles.promptComposer}>
            <textarea
              className={styles.promptInput}
              placeholder="Message SupaMinds..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendPrompt();
                }
              }}
              rows={3}
            />
            <div className={styles.composerActions}>
              <button
                type="button"
                className={styles.ghostBtn}
                disabled={sendingPrompt || !chatMessages.some((m) => m.role === "user")}
                onClick={() => void regenerateLast()}
              >
                Regenerate
              </button>
              <button className={styles.sendBtn} disabled={!hasChatAccess || sendingPrompt || !prompt.trim()} onClick={() => void sendPrompt()}>
                {sendingPrompt ? "Sending..." : "Send prompt"}
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
