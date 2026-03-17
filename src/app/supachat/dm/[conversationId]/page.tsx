"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./page.module.css";
import scrowStyles from "@/app/supascrow/page.module.css";
import MessageBubble from "@/app/supachat/components/MessageBubble";
import MessageInput from "@/app/supachat/components/MessageInput";
import UserAvatar from "@/app/supachat/components/UserAvatar";
import CreateEscrowModal from "@/components/supascrow/CreateEscrowModal";
import AttachListingModal from "@/app/supachat/components/AttachListingModal";
import { getSupaChatBrowserClient } from "@/lib/supachat/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useProfileOnline } from "@/components/providers/PresenceProvider";
import { startSupaChatPayment } from "@/lib/supachat/pi-client";
import ToastBanner from "@/components/ui/ToastBanner";

function formatLastSeen(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  if (diff < 604800_000) return `${Math.floor(diff / 86400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function SupaChatDMPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = String(params?.conversationId ?? "");
  const router = useRouter();
  const { user } = useAuth();

  const [messages, setMessages] = useState<any[]>([]);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [reconnecting, setReconnecting] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error" | "critical"; message: string } | null>(null);
  const [sanction, setSanction] = useState<{ type: "muted" | "banned"; reason?: string; expires_at?: string | null } | null>(null);
  const [sendPiModalOpen, setSendPiModalOpen] = useState(false);
  const [sendPiAmount, setSendPiAmount] = useState("");
  const [sendPiNote, setSendPiNote] = useState("");
  const [sendPiSending, setSendPiSending] = useState(false);
  const [sendPiCommissionPct, setSendPiCommissionPct] = useState<number | null>(null);
  const [supascrowModalOpen, setSupascrowModalOpen] = useState(false);
  const [attachListingModalOpen, setAttachListingModalOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const isOtherOnline = useProfileOnline(otherUser?.id);
  const toastTimerRef = useRef<number | null>(null);
  const token = useMemo(
    () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : ""),
    []
  );

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

  const fetchData = async () => {
    setLoading(true);
    const r = await fetch(`/api/supachat/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    if (d.success) {
      setMessages(d.data ?? []);
      setSanction(d.sanction ?? null);
    }

    const convo = await fetch("/api/supachat/conversations", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const convoJson = await convo.json();
    if (convoJson.success) {
      const match = (convoJson.data ?? []).find((c: any) => c.id === conversationId);
      setOtherUser(match?.other_user ?? null);
    }
    setLoading(false);
    scrollToBottom();
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const supabase = getSupaChatBrowserClient();
    setReconnecting(false);

    const channel = supabase
      .channel(`supachat-dm-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "supachat_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const newMsg = payload.new as any;
          setMessages((prev) => {
            const filtered = prev.filter((m) => {
              if (m.id?.toString().startsWith?.("optimistic-") && m.sender_id === newMsg.sender_id && m.content === newMsg.content && m.type === newMsg.type) {
                return false;
              }
              return true;
            });
            return [...filtered, newMsg];
          });
          scrollToBottom();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "supachat_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const old = payload.old as any;
          if (old?.id) setMessages((prev) => prev.filter((m) => m.id !== old.id));
        }
      )
      .subscribe((status) => {
        setReconnecting(status !== "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

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

    const r = await fetch(`/api/supachat/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: body, type: "text" }),
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

  const openAttachListingModal = () => {
    if (sanction) return;
    setAttachListingModalOpen(true);
  };

  const handleAttachListingSelect = async (listing: { id: string; title: string; images?: string[] | null; price_pi?: number }) => {
    setAttachListingModalOpen(false);
    const coverImage = listing.images?.[0] ?? null;
    const meta = {
      href: `/supamarket/${listing.id}`,
      listing_id: listing.id,
      ...(coverImage && { image: coverImage }),
      ...(listing.price_pi != null && { price_pi: listing.price_pi }),
    };
    const optimistic = {
      id: `optimistic-${Date.now()}`,
      sender_id: user?.id,
      content: listing.title,
      type: "listing_share",
      metadata: meta,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom();
    const r = await fetch(`/api/supachat/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        content: listing.title,
        type: "listing_share",
        metadata: meta,
      }),
    });
    const d = await r.json();
    if (!d?.success) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      showToast(d?.error ?? "Failed to share listing", "error");
    }
  };

  const openSendPiModal = () => {
    if (sanction) return;
    setSendPiAmount("");
    setSendPiNote("");
    setSendPiModalOpen(true);
    fetch("/api/config/commission")
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && typeof d.data?.supachat_transfer_commission_pct === "number") {
          setSendPiCommissionPct(d.data.supachat_transfer_commission_pct);
        }
      })
      .catch(() => {});
  };

  const confirmSendPi = async () => {
    const amount = Number(sendPiAmount.trim());
    const note = sendPiNote.trim() || "Tip sent in DM";
    if (!amount || amount <= 0 || !otherUser?.id) return;
    setSendPiSending(true);
    try {
      showToast("Opening Pi payment...", "success");
      await startSupaChatPayment({
        amountPi: amount,
        memo: `SupaChat DM tip`,
        token,
        metadata: { kind: "dm_tip", conversation_id: conversationId, receiver_id: otherUser.id },
        onCompleted: async ({ paymentId, txid }) => {
          const res = await fetch("/api/supachat/transfer", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              receiverId: otherUser.id,
              conversationId,
              amountPi: amount,
              note,
              pi_payment_id: paymentId,
              txid,
              idempotencyKey: `dm-tip-${conversationId}-${user?.id}-${Date.now()}`,
            }),
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.error || "Tip failed");
          showToast(`Tip sent successfully`, "success");
          setSendPiModalOpen(false);
        },
        onCancelled: () => { showToast("Payment cancelled", "error"); setSendPiModalOpen(false); },
        onError: (err) => { showToast(err.message, "error"); setSendPiModalOpen(false); },
      });
    } finally {
      setSendPiSending(false);
    }
  };

  const openSupascrowModal = () => {
    setSupascrowModalOpen(true);
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (messageId?.toString().startsWith?.("optimistic-")) return;
    const r = await fetch(`/api/supachat/conversations/${conversationId}/messages/${messageId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    if (d?.success) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } else {
      showToast(d?.error ?? "Gagal padam mesej", "error");
    }
  };

  const handleDealCreated = (dealId: string) => {
    fetch(`/api/supachat/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        content: "🤝 A deal has been created. View Deal →",
        type: "system",
        metadata: { deal_intent: true, deal_id: dealId },
      }),
    }).catch(() => {});
    showToast("Deal created successfully", "success");
    router.push(`/supascrow?deal=${dealId}`);
  };

  return (
    <div className={styles.page}>
      {toast && (
        <ToastBanner type={toast.type} message={toast.message} />
      )}
      <header className={styles.topBar}>
        <Link href="/supachat" className={styles.backBtn}>←</Link>
        <div className={styles.topBarUser}>
          <UserAvatar username={otherUser?.username} avatarUrl={otherUser?.avatar_url} online={isOtherOnline} verified={Boolean(otherUser?.verified)} />
          <div className={styles.topBarText}>
            <div className={styles.topBarName}>{otherUser?.display_name || `@${otherUser?.username || "Unknown"}`}</div>
            <div className={styles.topBarMeta}>
              {isOtherOnline ? "Online" : otherUser?.last_seen ? `Last seen ${formatLastSeen(otherUser.last_seen)}` : "Offline"}
            </div>
          </div>
        </div>
      </header>

      {reconnecting && <div className={styles.reconnectBanner}>Reconnecting to live chat...</div>}

      <div ref={listRef} className={styles.messages}>
        {loading ? (
          <div className={styles.skeletonWrap}>
            {[...Array(10)].map((_, i) => <div key={i} className={styles.skeletonBubble} />)}
          </div>
        ) : messages.length === 0 ? (
          <div className={styles.empty}>No messages yet. Say hello 👋</div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              id={m.id}
              own={m.sender_id === user?.id}
              content={m.content}
              type={m.type}
              metadata={m.metadata}
              timestamp={m.created_at}
              onDelete={handleDeleteMessage}
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

      <MessageInput
        value={text}
        onChange={setText}
        onSend={sendText}
        sending={sending}
        onPiTransfer={openSendPiModal}
        onCreateDeal={openSupascrowModal}
        onAttachListing={openAttachListingModal}
        disabled={Boolean(sanction)}
      />

      {sendPiModalOpen && (
        <div className={scrowStyles.modalOverlay} onClick={() => !sendPiSending && setSendPiModalOpen(false)}>
          <div className={`${scrowStyles.modal} ${scrowStyles.createModal}`} onClick={(e) => e.stopPropagation()}>
            <div className={scrowStyles.createModalHeader}>
              <div className={scrowStyles.createModalIcon}>π</div>
              <div className={scrowStyles.createModalBadge}>Pi Transfer</div>
              <h2 className={scrowStyles.createModalTitle}>Send Pi</h2>
              <p className={scrowStyles.createModalSub}>Send Pi to @{otherUser?.username ?? "?"}</p>
            </div>
            <div className={scrowStyles.createModalBody}>
              <div className={scrowStyles.formGroup}>
                <label className={scrowStyles.formLabel}>Amount π</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className={scrowStyles.input}
                  placeholder="0.00π"
                  value={sendPiAmount}
                  onChange={(e) => setSendPiAmount(e.target.value)}
                />
              </div>
              <div className={scrowStyles.formGroup}>
                <label className={scrowStyles.formLabel}>Description <span className={scrowStyles.formLabelOpt}>(optional)</span></label>
                <textarea
                  className={scrowStyles.textarea}
                  placeholder="Purpose or message for this transfer..."
                  value={sendPiNote}
                  onChange={(e) => setSendPiNote(e.target.value)}
                  maxLength={200}
                  rows={3}
                />
              </div>
              {sendPiCommissionPct != null && (
                <p className={scrowStyles.feeNote}>* Note: Admin fees ({sendPiCommissionPct}%) are deducted from this transfer.</p>
              )}
            </div>
            <div className={scrowStyles.createModalFooter}>
              <button className={scrowStyles.btnSecondary} onClick={() => setSendPiModalOpen(false)} disabled={sendPiSending}>
                Cancel
              </button>
              <button
                className={scrowStyles.btnPrimary}
                onClick={confirmSendPi}
                disabled={sendPiSending || !sendPiAmount.trim() || Number(sendPiAmount) <= 0}
              >
                {sendPiSending ? "Opening..." : "Send π"}
              </button>
            </div>
          </div>
        </div>
      )}

      {attachListingModalOpen && (
        <AttachListingModal
          onClose={() => setAttachListingModalOpen(false)}
          onSelect={handleAttachListingSelect}
          token={token}
        />
      )}

      {supascrowModalOpen && (
        <CreateEscrowModal
          onClose={() => setSupascrowModalOpen(false)}
          onSuccess={handleDealCreated}
          defaultSeller={otherUser?.username ?? ""}
          token={token}
        />
      )}
    </div>
  );
}
