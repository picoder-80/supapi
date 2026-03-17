"use client";

import { useState, useEffect } from "react";
import styles from "./LiveGiftPanel.module.css";

interface Gift { id: string; name: string; emoji: string; amount_sc: number; sort_order: number }
interface Props {
  sessionId: string;
  token: () => string;
  onSent?: () => void;
}

export default function LiveGiftPanel({ sessionId, token, onSent }: Props) {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [sending, setSending] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/live/gifts")
      .then((r) => r.json())
      .then((d) => { if (d.success) setGifts(d.data?.gifts ?? []); });
    fetch("/api/credits", { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((d) => { if (d.success) setBalance(d.data?.wallet?.balance ?? 0); });
  }, [sessionId]);

  const sendGift = async (g: Gift) => {
    setSending(g.id);
    try {
      const r = await fetch(`/api/live/${sessionId}/gift`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ gift_id: g.id, amount_sc: g.amount_sc, name: g.name, emoji: g.emoji }),
      });
      const d = await r.json();
      if (d.success) {
        setBalance((b) => (b ?? 0) - g.amount_sc);
        onSent?.();
      } else alert(d.error ?? "Failed to send gift");
    } catch { alert("Failed to send gift"); }
    setSending(null);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.title}>Send Gift</div>
      {balance !== null && <div className={styles.balance}>Balance: {balance} SC</div>}
      <div className={styles.grid}>
        {gifts.map((g) => (
          <button
            key={g.id}
            type="button"
            className={styles.giftBtn}
            onClick={() => sendGift(g)}
            disabled={sending !== null || (balance ?? 0) < g.amount_sc}
            title={`${g.emoji} ${g.name} — ${g.amount_sc} SC`}
          >
            <span className={styles.giftEmoji}>{g.emoji}</span>
            <span className={styles.giftName}>{g.name}</span>
            <span className={styles.giftPrice}>{g.amount_sc} SC</span>
          </button>
        ))}
      </div>
    </div>
  );
}
