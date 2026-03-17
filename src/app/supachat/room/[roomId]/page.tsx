"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./page.module.css";
import MessageBubble from "@/app/supachat/components/MessageBubble";
import MessageInput from "@/app/supachat/components/MessageInput";
import { getSupaChatBrowserClient } from "@/lib/supachat/client";
import { startSupaChatPayment } from "@/lib/supachat/pi-client";
import ToastBanner from "@/components/ui/ToastBanner";

export default function SupaChatRoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = String(params?.roomId ?? "");
  const router = useRouter();
  const { user } = useAuth();
  const token = useMemo(
    () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : ""),
    []
  );

  const [room, setRoom] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [needsEntry, setNeedsEntry] = useState(false);
  const [payingEntry, setPayingEntry] = useState(false);
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

  const fetchRoomMeta = async () => {
    const rr = await fetch("/api/supachat/rooms");
    const rj = await rr.json();
    const found = (rj.data ?? []).find((x: any) => x.id === roomId) ?? null;
    setRoom(found);
  };

  const fetchMessages = async () => {
    const r = await fetch(`/api/supachat/rooms/${roomId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    if (d.success) {
      setNeedsEntry(false);
      setMessages(d.data?.messages ?? []);
      setMembers(d.data?.members ?? []);
      setSanction(d.sanction ?? null);
      scrollToBottom();
    } else if (r.status === 402) {
      setNeedsEntry(true);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchRoomMeta(), fetchMessages()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const supabase = getSupaChatBrowserClient();
    const channel = supabase
      .channel(`supachat-room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "supachat_room_messages", filter: `room_id=eq.${roomId}` },
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
  }, [roomId]);

  const sendText = async () => {
    const body = text.trim();
    if (!body || sending || needsEntry || sanction) return;
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

    const r = await fetch(`/api/supachat/rooms/${roomId}/messages`, {
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

  const joinPaidRoom = async () => {
    if (!room) return;
    setPayingEntry(true);
    let joined = false;
    try {
      if (Number(room.entry_fee_pi ?? 0) > 0) {
        showToast("Opening Pi payment...", "success");
        await startSupaChatPayment({
          amountPi: Number(room.entry_fee_pi),
          memo: `Join room ${room.name}`,
          token,
          metadata: { kind: "room_entry", room_id: roomId },
          onCompleted: async ({ paymentId, txid }) => {
            const res = await fetch(`/api/supachat/rooms/${roomId}/enter`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ txid, pi_payment_id: paymentId }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Unable to join room");
            joined = true;
            showToast("Room joined successfully", "success");
          },
          onCancelled: () => showToast("Payment cancelled", "error"),
          onError: (err) => showToast(err.message, "error"),
        });
      } else {
        const res = await fetch(`/api/supachat/rooms/${roomId}/enter`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ txid: null, pi_payment_id: null }),
        });
        const json = await res.json();
        joined = Boolean(json?.success);
        if (joined) showToast("Room joined successfully", "success");
      }
      if (joined) {
        setNeedsEntry(false);
        await fetchMessages();
      }
    } finally {
      setPayingEntry(false);
    }
  };

  const triggerRain = async () => {
    if (sanction) return;
    const total = Number(window.prompt("Total Pi to scatter") ?? "");
    if (!total || total <= 0) return;
    showToast("Opening Pi payment...", "success");
    await startSupaChatPayment({
      amountPi: total,
      memo: `Pi Rain in ${room?.name || "room"}`,
      token,
      metadata: { kind: "rain", room_id: roomId },
      onCompleted: async ({ paymentId, txid }) => {
        const res = await fetch("/api/supachat/rain", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            roomId,
            totalPi: total,
            txid,
            pi_payment_id: paymentId,
            idempotencyKey: `rain-${roomId}-${user?.id}-${Date.now()}`,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Pi Rain failed");
        showToast("Pi Rain completed", "success");
      },
      onCancelled: () => showToast("Payment cancelled", "error"),
      onError: (err) => showToast(err.message, "error"),
    });
  };

  const sendTipToHost = async () => {
    if (sanction) return;
    if (!room?.created_by) return;
    const amount = Number(window.prompt("Tip host (Pi amount)") ?? "");
    if (!amount || amount <= 0) return;
    showToast("Opening Pi payment...", "success");
    await startSupaChatPayment({
      amountPi: amount,
      memo: `Tip in ${room?.name || "room"}`,
      token,
      metadata: { kind: "room_tip", room_id: roomId, receiver_id: room.created_by },
      onCompleted: async ({ paymentId, txid }) => {
        const res = await fetch("/api/supachat/transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            receiverId: room.created_by,
            roomId,
            amountPi: amount,
            note: `Tip in ${room?.name || "room"}`,
            pi_payment_id: paymentId,
            txid,
            idempotencyKey: `room-tip-${user?.id}-${roomId}-${Date.now()}`,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Tip failed");
        showToast("Tip sent successfully", "success");
      },
      onCancelled: () => showToast("Payment cancelled", "error"),
      onError: (err) => showToast(err.message, "error"),
    });
  };

  const canRain = members.some((m) => m.user_id === user?.id && (m.role === "host" || m.role === "moderator"));

  return (
    <div className={styles.page}>
      {toast && (
        <ToastBanner type={toast.type} message={toast.message} />
      )}
      <header className={styles.topBar}>
        <Link href="/supachat" className={styles.backBtn}>←</Link>
        <div className={styles.topBarText}>
          <div className={styles.topBarName}>{room?.name || "Room"}</div>
          <div className={styles.topBarMeta}>
            {members.length} members · {room?.type === "paid" ? `π${room?.entry_fee_pi} PAID` : "FREE"}
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
        ) : needsEntry ? (
          <div className={styles.paywall}>
            <div className={styles.paywallTitle}>Join this room for π{room?.entry_fee_pi ?? 0}</div>
            <div className={styles.paywallSub}>20% commission goes to Supapi, 80% to room host.</div>
            <button className={styles.payBtn} onClick={joinPaidRoom} disabled={payingEntry}>
              {payingEntry ? "Joining..." : "Pay & Join"}
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

      {sanction && (
        <div className={styles.sanctionBanner}>
          {sanction.type === "banned"
            ? "🚫 You are permanently banned. Contact support."
            : `🔇 You are muted until ${
                sanction.expires_at ? new Date(sanction.expires_at).toLocaleString("en-MY") : "later"
              }. Reason: ${sanction.reason ?? "policy violation"}`}
        </div>
      )}

      {!needsEntry && (
        <MessageInput
          value={text}
          onChange={setText}
          onSend={sendText}
          onAttachListing={() => router.push("/supamarket")}
          onPiTransfer={sendTipToHost}
          onCreateDeal={canRain ? triggerRain : undefined}
          secondaryIcon="🌧️"
          secondaryLabel="Pi Rain"
          sending={sending}
          placeholder="Message room..."
          disabled={Boolean(sanction)}
        />
      )}
    </div>
  );
}
