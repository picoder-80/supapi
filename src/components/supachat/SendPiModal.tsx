"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/supascrow/page.module.css";
import { startSupaChatPayment } from "@/lib/supachat/pi-client";

type SendPiModalProps = {
  onClose: () => void;
  onSuccess?: () => void;
  onCancelled?: () => void;
  onError?: (msg: string) => void;
  receiverId: string;
  receiverUsername: string;
  conversationId?: string | null;
  token: string;
  senderId?: string;
  defaultNote?: string;
  redirectToDm?: boolean;
  /** If false, recipient cannot receive Pi (no pi_uid). Show warning and disable send. */
  canReceivePi?: boolean;
};

export default function SendPiModal({
  onClose,
  onSuccess,
  onCancelled,
  onError,
  receiverId,
  receiverUsername,
  conversationId: initialConversationId,
  token,
  senderId,
  defaultNote = "Tip sent in DM",
  redirectToDm = false,
  canReceivePi = true,
}: SendPiModalProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [commissionPct, setCommissionPct] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId ?? null);
  const [dmLoading, setDmLoading] = useState(!initialConversationId);

  useEffect(() => {
    if (initialConversationId) return;
    fetch("/api/supachat/dm", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ receiverId }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && d?.data?.conversationId) setConversationId(d.data.conversationId);
      })
      .catch(() => {})
      .finally(() => setDmLoading(false));
  }, [receiverId, token, initialConversationId]);

  useEffect(() => {
    fetch("/api/config/commission")
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && typeof d.data?.supachat_transfer_commission_pct === "number") {
          setCommissionPct(d.data.supachat_transfer_commission_pct);
        }
      })
      .catch(() => {});
  }, []);

  const handleSend = async () => {
    const amountNum = Number(amount.trim());
    const noteText = note.trim() || defaultNote;
    if (!amountNum || amountNum <= 0) return;
    if (!conversationId && !initialConversationId) return;
    const convId = conversationId ?? initialConversationId;
    if (!convId) return;

    setSending(true);
    try {
      await startSupaChatPayment({
        amountPi: amountNum,
        memo: `Tip for @${receiverUsername}`,
        token,
        metadata: { kind: "dm_tip", conversation_id: convId, receiver_id: receiverId },
        onCompleted: async ({ paymentId, txid }) => {
          const res = await fetch("/api/supachat/transfer", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              receiverId,
              conversationId: convId,
              amountPi: amountNum,
              note: noteText,
              pi_payment_id: paymentId,
              txid,
              idempotencyKey: `tip-${senderId ?? "user"}-${receiverId}-${Date.now()}`,
            }),
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.error || "Tip failed");
          onClose();
          onSuccess?.();
          if (redirectToDm) router.push(`/supachat/dm/${convId}`);
        },
        onCancelled: () => {
          setSending(false);
          onClose();
          onCancelled?.();
        },
        onError: (err) => {
          setSending(false);
          onError?.(err.message);
        },
      });
    } catch {
      setSending(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={() => !sending && onClose()}>
      <div className={`${styles.modal} ${styles.createModal}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.createModalHeader}>
          <div className={styles.createModalIcon}>π</div>
          <div className={styles.createModalBadge}>Pi Transfer</div>
          <h2 className={styles.createModalTitle}>Send Pi</h2>
          <p className={styles.createModalSub}>Send Pi to @{receiverUsername}</p>
        </div>
        <div className={styles.createModalBody}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Amount π</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className={styles.input}
              placeholder="0.00π"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Description <span className={styles.formLabelOpt}>(optional)</span></label>
            <textarea
              className={styles.textarea}
              placeholder="Purpose or message for this transfer..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              rows={3}
            />
          </div>
          {!canReceivePi && (
            <div className={styles.piWarning} role="alert">
              <strong>Recipient cannot receive Pi.</strong> They must sign in with Pi and activate their wallet to receive payments.
            </div>
          )}
          {commissionPct != null && (
            <p className={styles.feeNote}>* Note: Admin fees ({commissionPct}%) are deducted from this transfer.</p>
          )}
        </div>
        <div className={styles.createModalFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={sending}>
            Cancel
          </button>
          <button
            className={styles.btnPrimary}
            onClick={handleSend}
            disabled={sending || !amount.trim() || Number(amount) <= 0 || dmLoading || !canReceivePi}
          >
            {dmLoading ? "Loading..." : sending ? "Opening..." : "Send π"}
          </button>
        </div>
      </div>
    </div>
  );
}
