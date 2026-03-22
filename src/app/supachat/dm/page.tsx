"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "../page.module.css";
import ConversationList from "../components/ConversationList";

export default function DMsInboxPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeUsername, setComposeUsername] = useState("");
  const [composeLoading, setComposeLoading] = useState(false);

  const token = useMemo(
    () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : ""),
    []
  );

  const fetchConversations = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/supachat/conversations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.success) setConversations(d.data ?? []);
      else setError(d.error ?? "Unable to load messages.");
    } catch {
      setError("Unable to load messages.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!token) {
      router.replace("/dashboard");
      return;
    }
    fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const startDM = async () => {
    const username = composeUsername.trim().replace(/^@/, "");
    if (!username) return;
    setComposeLoading(true);
    try {
      const r = await fetch(`/api/users/search?q=${encodeURIComponent(username)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      const candidate = d?.data?.find(
        (u: any) => String(u.username).toLowerCase() === username.toLowerCase()
      );
      if (!candidate?.id) throw new Error("User not found");

      const dm = await fetch("/api/supachat/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ receiverId: candidate.id }),
      });
      const dmJson = await dm.json();
      if (!dmJson.success) throw new Error(dmJson.error ?? "Unable to create conversation");
      setComposeOpen(false);
      setComposeUsername("");
      router.push(`/supachat/dm/${dmJson.data.conversationId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to start conversation.");
    }
    setComposeLoading(false);
  };

  if (!user && !token) return null;

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/supaspace" className={styles.backLink} aria-label="Back to SupaSpace">
          ←
        </Link>
        <div className={styles.topBarTitle}>DMs</div>
        <button className={styles.composeBtn} onClick={() => setComposeOpen(true)} aria-label="New message">
          ✏️
        </button>
      </header>

      <main className={styles.content}>
        {error && <div className={styles.errorBanner}>{error}</div>}

        {loading ? (
          <div className={styles.skeletonList}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className={styles.skeletonRow} />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>💬</div>
            <div className={styles.emptyTitle}>No messages yet</div>
            <div className={styles.emptySub}>Start a conversation with another Pioneer.</div>
            <button className={styles.emptyBtn} onClick={() => setComposeOpen(true)}>
              New message
            </button>
          </div>
        ) : (
          <ConversationList conversations={conversations} />
        )}
      </main>

      {composeOpen && (
        <div className={styles.modalOverlay} onClick={() => setComposeOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>New message</div>
            <input
              className={styles.modalInput}
              placeholder="@username"
              value={composeUsername}
              onChange={(e) => setComposeUsername(e.target.value)}
            />
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setComposeOpen(false)}>
                Cancel
              </button>
              <button
                className={styles.modalConfirm}
                onClick={startDM}
                disabled={composeLoading || !composeUsername.trim()}
              >
                {composeLoading ? "Opening..." : "Chat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
