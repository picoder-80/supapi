"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "../../room/[roomId]/page.module.css";
import MessageBubble from "@/app/supachat/components/MessageBubble";
import MessageInput from "@/app/supachat/components/MessageInput";
import { getSupaChatBrowserClient } from "@/lib/supachat/client";
import ToastBanner from "@/components/ui/ToastBanner";

export default function SupaChatGroupPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = String(params?.groupId ?? "");
  const { user } = useAuth();
  const token = useMemo(
    () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : ""),
    []
  );

  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [joining, setJoining] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [reconnecting, setReconnecting] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error" | "critical"; message: string } | null>(null);
  const [sanction, setSanction] = useState<{ type: "muted" | "banned"; reason?: string; expires_at?: string | null } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<number | null>(null);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  };

  const showToast = (
    message: string,
    type: "success" | "error" | "critical" = "success",
    durationMs = 2800
  ) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ type, message });
    toastTimerRef.current = window.setTimeout(() => setToast(null), durationMs);
  };

  const fetchGroup = async () => {
    const r = await fetch(`/api/supachat/groups/${groupId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    if (d.success) setGroup(d.data);
  };

  const fetchMessages = async () => {
    const r = await fetch(`/api/supachat/groups/${groupId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    if (d.success) {
      setMessages(d.data?.messages ?? []);
      setMembers(d.data?.members ?? []);
      setSanction(d.sanction ?? null);
      scrollToBottom();
    }
  };

  useEffect(() => {
    setLoading(true);
    (async () => {
      const r = await fetch(`/api/supachat/groups/${groupId}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.success) {
        setGroup(d.data);
        const member = d.data.is_member ?? false;
        setIsMember(member);
        if (member) {
          await fetchMessages();
        }
      }
      scrollToBottom();
    })().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const supabase = getSupaChatBrowserClient();
    const channel = supabase
      .channel(`supachat-group-${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "supachat_group_messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          scrollToBottom();
        }
      )
      .subscribe((status) => {
        setReconnecting(status !== "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  const joinGroup = async () => {
    if (!user || joining) return;
    setJoining(true);
    try {
      const r = await fetch(`/api/supachat/groups/${groupId}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.success) {
        setIsMember(true);
        await fetchMessages();
        showToast("Joined group!");
      } else {
        showToast(d?.error ?? "Failed to join", "error");
      }
    } catch {
      showToast("Failed to join", "error");
    } finally {
      setJoining(false);
    }
  };

  const sendText = async () => {
    const body = text.trim();
    if (!body || sending || sanction) return;
    setSending(true);
    const optimistic = {
      id: `optimistic-${Date.now()}`,
      sender_id: user?.id,
      content: body,
      type: "text",
      created_at: new Date().toISOString(),
      metadata: {},
    };
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    scrollToBottom();

    const r = await fetch(`/api/supachat/groups/${groupId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: body }),
    });
    if (!r.ok) {
      const json = await r.json().catch(() => ({}));
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setText(body);
      if (r.status === 400 && json?.moderation) {
        const sanctionType = String(json?.sanction ?? "deleted_only");
        const category = String(json?.category ?? "other");
        if (sanctionType === "muted_1h") {
          showToast(`🔇 You have been muted for 1 hour due to: ${category}`, "critical", 5000);
          setSanction({ type: "muted", reason: category });
        } else if (sanctionType === "muted_24h") {
          showToast(`🔇 You have been muted for 24 hours due to: ${category}`, "critical", 5000);
          setSanction({ type: "muted", reason: category });
        } else if (sanctionType === "banned") {
          showToast("🚫 You have been permanently banned from SupaChat.", "critical", 5000);
          setSanction({ type: "banned", reason: category, expires_at: null });
        } else {
          showToast("⚠️ Your message was removed by AI moderator.", "critical", 5000);
        }
      } else if (r.status === 403 && json?.sanction) {
        setSanction(json.sanction);
        if (json.sanction?.type === "banned") {
          showToast("🚫 You have been permanently banned from SupaChat.", "critical", 5000);
        } else {
          showToast("🔇 You are currently muted.", "critical", 5000);
        }
      }
    }
    setSending(false);
  };

  return (
    <div className={styles.page}>
      {toast && (
        <ToastBanner type={toast.type} message={toast.message} />
      )}
      <header className={styles.topBar}>
        <Link href="/supachat" className={styles.backBtn}>←</Link>
        <div className={styles.topBarText}>
          <div className={styles.topBarName}>{group?.name || "Group"}</div>
          <div className={styles.topBarMeta}>
            {members.length} members
          </div>
        </div>
      </header>

      {reconnecting && <div className={styles.reconnectBanner}>Realtime reconnecting...</div>}

      <div className={styles.memberStrip}>
        {members.slice(0, 10).map((m) => (
          <div key={m.user_id} className={styles.memberChip}>{(m.user_id || "?").slice(0, 2).toUpperCase()}</div>
        ))}
        {members.length > 10 && <div className={styles.memberChip}>+{members.length - 10}</div>}
      </div>

      <div ref={listRef} className={styles.messages}>
        {loading ? (
          <div className={styles.skeletonWrap}>
            {[...Array(10)].map((_, i) => <div key={i} className={styles.skeletonBubble} />)}
          </div>
        ) : !isMember ? (
          <div className={styles.paywall}>
            <div className={styles.paywallTitle}>Join {group?.name || "this group"}</div>
            <div className={styles.paywallSub}>{group?.description || "Join to view and send messages."}</div>
            <button className={styles.payBtn} onClick={joinGroup} disabled={joining}>
              {joining ? "Joining..." : "Join Group"}
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className={styles.empty}>No messages yet.</div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              own={m.sender_id === user?.id}
              content={m.content}
              type={m.type}
              metadata={m.metadata}
              timestamp={m.created_at}
            />
          ))
        )}
      </div>

      {isMember && sanction && (
        <div className={styles.sanctionBanner}>
          {sanction.type === "banned"
            ? "🚫 You are permanently banned. Contact support."
            : `🔇 You are muted until ${
                sanction.expires_at ? new Date(sanction.expires_at).toLocaleString("en-MY") : "later"
              }. Reason: ${sanction.reason ?? "policy violation"}`}
        </div>
      )}

      {isMember && (
        <MessageInput
          value={text}
          onChange={setText}
          onSend={sendText}
          onAttachListing={() => {}}
          sending={sending}
          placeholder="Message group..."
          disabled={Boolean(sanction)}
        />
      )}
    </div>
  );
}
