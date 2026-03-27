"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { createPiPayment, ensurePaymentReady, isPiBrowser } from "@/lib/pi/sdk";
import styles from "./page.module.css";

type LivePlan = {
  id: string;
  code: string;
  name: string;
  price_usd: number;
  plan_type: string;
  features: Record<string, unknown>;
};

type Invoice = {
  id: string;
  amount_usd: number;
  amount_pi: number;
  pi_usd_rate: number;
  quote_expires_at: string;
};

export default function GoLivePage() {
  const { user } = useAuth();
  const router = useRouter();
  const token = useMemo(() => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : ""), []);

  const [title, setTitle] = useState("");
  const [plans, setPlans] = useState<LivePlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>("live_session");
  const [hasMonthly, setHasMonthly] = useState(false);
  const [piRate, setPiRate] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"setup" | "streaming">("setup");
  const [streamInfo, setStreamInfo] = useState<{
    session_id: string;
    stream_key: string;
    rtmps_url: string;
    playback_url: string;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !token) return;
    fetch("/api/live/plans", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setPlans(d.data.plans ?? []);
          setHasMonthly(d.data.has_monthly ?? false);
          setPiRate(Number(d.data.pi_rate ?? 0));
        }
      }).catch(() => {});
  }, [user, token]);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  };

  const endLive = async () => {
    if (!streamInfo) return;
    try {
      await fetch(`/api/live/${streamInfo.session_id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      router.push("/live");
    } catch {}
  };

  const handleGoLive = async () => {
    if (!user || !token) return;
    setSubmitting(true);
    setError("");

    try {
      if (hasMonthly) {
        const r = await fetch("/api/live/start", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title: title.trim() || undefined }),
        });
        const d = await r.json();
        if (d.success) { setStreamInfo(d.data); setStep("streaming"); }
        else setError(d.error ?? "Failed to start live");
        setSubmitting(false);
        return;
      }

      if (!isPiBrowser()) {
        setError("Open in Pi Browser to go live.");
        setSubmitting(false);
        return;
      }

      const quoteRes = await fetch("/api/live/payment/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan_code: selectedPlan }),
      });
      const quote = await quoteRes.json();

      if (!quote.success) {
        setError(quote.error ?? "Failed to create quote");
        setSubmitting(false);
        return;
      }

      if (quote.data?.free) {
        const r = await fetch("/api/live/start", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title: title.trim() || undefined }),
        });
        const d = await r.json();
        if (d.success) { setStreamInfo(d.data); setStep("streaming"); }
        else setError(d.error ?? "Failed");
        setSubmitting(false);
        return;
      }

      const invoice = quote.data.invoice as Invoice;
      await ensurePaymentReady();

      createPiPayment(
        {
          amount: Number(invoice.amount_pi),
          memo: selectedPlan === "live_monthly"
            ? "SupaLive Monthly — Unlimited live sessions"
            : "SupaLive Session — Go live now",
          metadata: { platform: "live", invoice_id: invoice.id, plan_code: selectedPlan },
        },
        {
          onReadyForServerApproval: (paymentId: string) => {
            fetch("/api/live/payment", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ action: "approve", invoice_id: invoice.id, paymentId }),
            }).catch(() => {});
          },
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            try {
              const r = await fetch("/api/live/payment", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  action: "complete",
                  invoice_id: invoice.id,
                  paymentId, txid,
                  plan_code: selectedPlan,
                  title: title.trim() || undefined,
                }),
              });
              const d = await r.json();
              if (!d.success) setError(d.error ?? "Payment failed");
              else if (d.data?.plan_type === "monthly") {
                setHasMonthly(true);
                alert("Monthly plan activated! Go live anytime.");
              } else {
                setStreamInfo(d.data);
                setStep("streaming");
              }
            } catch { setError("Payment completion failed"); }
            setSubmitting(false);
          },
          onCancel: () => { setError("Payment cancelled."); setSubmitting(false); },
          onError: () => { setError("Payment error."); setSubmitting(false); },
        }
      );
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.loginPrompt}>
          <div className={styles.loginIcon}>🔴</div>
          <div className={styles.loginTitle}>Sign in to go live</div>
          <Link href="/dashboard" className={styles.loginBtn}>Sign In with Pi</Link>
        </div>
      </div>
    );
  }

  if (step === "streaming" && streamInfo) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>🔴 You are Live!</h1>
        </div>
        <div className={styles.body}>
          <div className={styles.liveActiveCard}>
            <div className={styles.liveDot} />
            <span className={styles.liveActiveLabel}>LIVE NOW</span>
          </div>
          <div className={styles.instructCard}>
            <div className={styles.instructTitle}>Stream from your phone or OBS</div>
            <p className={styles.instructSub}>Use these details in Larix Broadcaster or OBS</p>
            <div className={styles.credField}>
              <div className={styles.credLabel}>RTMPS URL</div>
              <div className={styles.credRow}>
                <code className={styles.credValue}>{streamInfo.rtmps_url}</code>
                <button className={styles.copyBtn} onClick={() => copyToClipboard(streamInfo.rtmps_url, "rtmps")}>
                  {copied === "rtmps" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            <div className={styles.credField}>
              <div className={styles.credLabel}>Stream Key</div>
              <div className={styles.credRow}>
                <code className={styles.credValue}>{streamInfo.stream_key}</code>
                <button className={styles.copyBtn} onClick={() => copyToClipboard(streamInfo.stream_key, "key")}>
                  {copied === "key" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            <div className={styles.appHint}>
              Recommended: <strong>Larix Broadcaster</strong> (free, iOS/Android, supports RTMPS)
            </div>
          </div>
          <Link href={`/live/${streamInfo.session_id}`} className={styles.viewLiveBtn}>
            View Live Page + Pin Products →
          </Link>
          <button className={styles.endLiveBtn} onClick={endLive}>
            End Live Session
          </button>
        </div>
      </div>
    );
  }

  const sessionPlan = plans.find(p => p.code === "live_session");
  const monthlyPlan = plans.find(p => p.code === "live_monthly");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/live" className={styles.backBtn}>Back</Link>
        <h1 className={styles.title}>Go Live</h1>
      </div>
      <div className={styles.body}>
        {error && <div className={styles.errorBanner}>{error}</div>}
        {hasMonthly && (
          <div className={styles.monthlyBadge}>
            Monthly plan active — go live for free anytime
          </div>
        )}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Stream title (optional)</div>
          <input
            type="text"
            className={styles.input}
            placeholder="What are you streaming today?"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={100}
          />
        </div>
        {!hasMonthly && (
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Choose your plan</div>
            <div className={styles.planGrid}>
              {sessionPlan && (
                <button
                  className={`${styles.planCard} ${selectedPlan === "live_session" ? styles.planCardActive : ""}`}
                  onClick={() => setSelectedPlan("live_session")}
                >
                  <div className={styles.planEmoji}>🎬</div>
                  <div className={styles.planName}>Per Session</div>
                  <div className={styles.planPrice}>${sessionPlan.price_usd.toFixed(2)}</div>
                  {piRate > 0 && <div className={styles.planPi}>approx {(sessionPlan.price_usd / piRate).toFixed(3)} Pi</div>}
                  <div className={styles.planDesc}>Pay each time you go live</div>
                </button>
              )}
              {monthlyPlan && (
                <button
                  className={`${styles.planCard} ${selectedPlan === "live_monthly" ? styles.planCardActive : ""}`}
                  onClick={() => setSelectedPlan("live_monthly")}
                >
                  <div className={styles.planEmoji}>♾️</div>
                  <div className={styles.planName}>Monthly</div>
                  <div className={styles.planPrice}>${monthlyPlan.price_usd.toFixed(2)}<span>/mo</span></div>
                  {piRate > 0 && <div className={styles.planPi}>approx {(monthlyPlan.price_usd / piRate).toFixed(3)} Pi</div>}
                  <div className={styles.planDesc}>Unlimited sessions for 30 days</div>
                  <div className={styles.planBadge}>Best value</div>
                </button>
              )}
            </div>
            <div className={styles.rateHint}>
              {piRate > 0 ? `1 Pi = $${piRate.toFixed(2)} USD (live rate)` : "Fetching Pi rate..."}
            </div>
          </div>
        )}
        <button className={styles.goLiveBtn} onClick={handleGoLive} disabled={submitting}>
          {submitting ? "Processing..." : hasMonthly ? "Go Live Now" : "Pay & Go Live"}
        </button>
        <div className={styles.noteBox}>
          After payment, you will receive stream credentials. Use Larix Broadcaster or OBS to broadcast.
          Pin products from your Supamarket listings so viewers can buy during your stream.
        </div>
      </div>
    </div>
  );
}
