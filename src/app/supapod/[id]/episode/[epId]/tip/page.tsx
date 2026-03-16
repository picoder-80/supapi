"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePi } from "@/components/providers/PiProvider";
import { usePiPayment } from "@/hooks/usePiPayment";
import { ensurePaymentReady } from "@/lib/pi/sdk";
import styles from "./page.module.css";

const PRESETS = [1, 5, 10, 25, 50, 100];

export default function EpisodeTipPage({ params }: { params: Promise<{ id: string; epId: string }> }) {
  const { id, epId } = use(params);
  const { user } = useAuth();
  const { isReady: piReady, isPiBrowser } = usePi();
  const { pay, isPaying, error } = usePiPayment();
  const router = useRouter();
  const [episode, setEpisode] = useState<{ id: string; title: string; podcast: { title: string; creator_id: string } } | null>(null);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const f = async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/supapod/episodes/${epId}`);
        const d = await r.json();
        if (d.success) setEpisode(d.data);
      } catch {}
      setLoading(false);
    };
    f();
  }, [epId]);

  const handleTip = async () => {
    if (!user || !episode) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;

    const token = localStorage.getItem("supapi_token");
    if (!token) { router.push("/dashboard"); return; }

    if (!isPiBrowser) {
      alert("Open in Pi Browser to tip with Pi.");
      return;
    }

    try {
      await ensurePaymentReady();
    } catch {
      alert("Pi Browser required for payments.");
      return;
    }

    const tipRes = await fetch("/api/podcast/tip", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ episode_id: epId, amount_pi: amt, message: message.trim() || undefined }),
    });
    const tipData = await tipRes.json();
    if (!tipData.success) {
      alert(tipData.error ?? "Failed to create tip");
      return;
    }

    const tipId = tipData.data?.tip_id ?? epId;
    pay({
      amountPi: amt,
      memo: `Tip for ${episode.title}`,
      type: "supapod_tip",
      referenceId: tipId,
      metadata: { episode_id: epId, creator_id: episode.podcast?.creator_id },
      onSuccess: () => router.push(`/supapod/${id}/episode/${epId}`),
      onCancel: () => {},
      onError: () => {},
    });
  };

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.authWall}>
          <div className={styles.authIcon}>🔒</div>
          <p>Sign in to tip</p>
          <button className={styles.authBtn} onClick={() => router.push("/dashboard")}>Sign In</button>
        </div>
      </div>
    );
  }

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (!episode) return <div className={styles.notFound}><Link href={`/supapod/${id}`}>← Back</Link></div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>← Back</button>
        <h1 className={styles.title}>Tip Creator</h1>
      </div>

      <div className={styles.card}>
        <h2 className={styles.epTitle}>{episode.title}</h2>
        <p className={styles.podcastName}>{episode.podcast?.title}</p>

        <div className={styles.amountSection}>
          <label>Amount (π)</label>
          <div className={styles.presets}>
            {PRESETS.map((p) => (
              <button key={p} type="button" className={styles.presetBtn} onClick={() => setAmount(String(p))}>{p}π</button>
            ))}
          </div>
          <input type="number" min="0.01" step="0.01" placeholder="Custom amount" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>

        <div className={styles.messageSection}>
          <label>Message (optional)</label>
          <textarea rows={2} placeholder="Thanks for the episode!" value={message} onChange={e => setMessage(e.target.value)} />
        </div>

        {!isPiBrowser && <p className={styles.piNote}>Open in Pi Browser to tip with Pi.</p>}
        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.tipBtn} onClick={handleTip} disabled={isPaying || !piReady || !amount}>
          {isPaying ? "Processing..." : `Tip ${amount || "0"}π`}
        </button>
      </div>
    </div>
  );
}
