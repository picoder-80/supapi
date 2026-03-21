"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { createPiPayment, ensurePaymentReady, isPiBrowser } from "@/lib/pi/sdk";
import styles from "./page.module.css";

type Plan = { id: string; code: string; name: string; price_usd: number; features?: Record<string, unknown> };
type Subscription = {
  id: string;
  status: string;
  cancel_at_period_end?: boolean;
  current_period_end?: string;
  plan?: { code: string; name: string; price_usd: number } | null;
};
type Invoice = {
  id: string;
  status: string;
  amount_usd: number;
  amount_pi: number;
  pi_usd_rate: number;
  quote_expires_at: string;
  created_at: string;
  paid_at?: string | null;
};
type TopupPack = { id: string; code: string; name: string; prompts: number; price_usd: number };
const DEFAULT_LIMITS: Record<string, number> = {
  free: 12,
  pro_monthly: 600,
  power_monthly: 1800,
};

export default function SupaMindsPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [piRate, setPiRate] = useState<number>(0);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [topupPacks, setTopupPacks] = useState<TopupPack[]>([]);
  const [topupBalance, setTopupBalance] = useState<number>(0);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const token = useMemo(() => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : ""), []);

  const fetchState = useCallback(async () => {
    if (!user || !token) return;
    const r = await fetch("/api/supaminds/subscription", { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json().catch(() => ({}));
    if (d?.success) {
      setPlans(d.data?.plans ?? []);
      setSubscription(d.data?.subscription ?? null);
      setInvoices(d.data?.invoices ?? []);
      setTopupPacks(d.data?.topup_packs ?? []);
      setTopupBalance(Number(d.data?.topup_balance ?? 0));
    }
  }, [user, token]);

  useEffect(() => { void fetchState(); }, [fetchState]);
  useEffect(() => {
    const loadPiRate = async () => {
      try {
        const r = await fetch("/api/pi-price");
        const d = await r.json().catch(() => ({}));
        const p = Number(d?.price ?? 0);
        if (p > 0) setPiRate(p);
      } catch {}
    };
    void loadPiRate();
    const timer = window.setInterval(() => {
      void loadPiRate();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const subscribe = async (planCode: string) => {
    if (!user || !token) return;
    if (!isPiBrowser()) {
      setMsg("Open in Pi Browser to subscribe.");
      return;
    }
    setBusyPlan(planCode);
    setMsg("");
    try {
      const quoteRes = await fetch("/api/supaminds/subscription/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan_code: planCode }),
      });
      const quote = await quoteRes.json().catch(() => ({}));
      if (!quote?.success) {
        setMsg(quote?.error ?? "Failed to create quote");
        setBusyPlan(null);
        return;
      }
      const invoice = quote.data.invoice as Invoice;
      await ensurePaymentReady();
      createPiPayment(
        {
          amount: Number(invoice.amount_pi),
          memo: `SupaMinds ${planCode} subscription`,
          metadata: { platform: "supaminds", invoice_id: invoice.id, plan_code: planCode },
        },
        {
          onReadyForServerApproval: (paymentId: string) => {
            fetch("/api/supaminds/subscription/payment", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ action: "approve", invoice_id: invoice.id, paymentId }),
            }).catch(() => {});
          },
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            try {
              const r = await fetch("/api/supaminds/subscription/payment", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ action: "complete", invoice_id: invoice.id, paymentId, txid }),
              });
              const d = await r.json().catch(() => ({}));
              if (!d?.success) {
                setMsg(d?.error ?? "Payment completion failed.");
              } else {
                setMsg("Subscription activated.");
                await fetchState();
              }
            } catch {
              setMsg("Payment completion failed.");
            }
            setBusyPlan(null);
          },
          onCancel: () => {
            setMsg("Payment cancelled.");
            setBusyPlan(null);
          },
          onError: () => {
            setMsg("Payment error.");
            setBusyPlan(null);
          },
        }
      );
    } catch {
      setMsg("Unable to start checkout.");
      setBusyPlan(null);
    }
  };

  const postAction = async (action: "cancel" | "resume", successMsg: string) => {
    if (!token) return;
    setBusyAction(action);
    setMsg("");
    try {
      const endpoints = action === "cancel"
        ? ["/api/supaminds/subscription/cancel", "/api/supaminds/subscription"]
        : ["/api/supaminds/subscription/resume", "/api/supaminds/subscription"];
      let done = false;
      let lastErr = "Action failed";
      for (const endpoint of endpoints) {
        const r = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: endpoint.endsWith("/subscription") ? JSON.stringify({ action }) : undefined,
        });
        const d = await r.json().catch(() => ({}));
        if (r.status === 404) {
          lastErr = "Endpoint not found";
          continue;
        }
        if (!d?.success) {
          lastErr = String(d?.error ?? "Action failed");
          break;
        }
        done = true;
        break;
      }
      if (!done) {
        setMsg(lastErr);
      } else {
        setMsg(successMsg);
        await fetchState();
      }
    } catch {
      setMsg("Action failed");
    }
    setBusyAction(null);
  };

  const buyTopup = async (packCode: string) => {
    if (!user || !token) return;
    if (!isPiBrowser()) {
      setMsg("Open in Pi Browser to buy topup.");
      return;
    }
    setBusyPlan(`topup:${packCode}`);
    setMsg("");
    try {
      const quoteRes = await fetch("/api/supaminds/subscription/topup/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pack_code: packCode }),
      });
      const quote = await quoteRes.json().catch(() => ({}));
      if (!quote?.success) {
        setMsg(quote?.error ?? "Failed to create topup quote");
        setBusyPlan(null);
        return;
      }
      const invoice = quote.data.invoice as Invoice;
      await ensurePaymentReady();
      createPiPayment(
        {
          amount: Number(invoice.amount_pi),
          memo: `SupaMinds topup ${packCode}`,
          metadata: { platform: "supaminds", invoice_id: invoice.id, kind: "topup", pack_code: packCode },
        },
        {
          onReadyForServerApproval: (paymentId: string) => {
            fetch("/api/supaminds/subscription/payment", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ action: "approve", kind: "topup", pack_code: packCode, invoice_id: invoice.id, paymentId }),
            }).catch(() => {});
          },
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            try {
              const r = await fetch("/api/supaminds/subscription/payment", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ action: "complete", kind: "topup", pack_code: packCode, invoice_id: invoice.id, paymentId, txid }),
              });
              const d = await r.json().catch(() => ({}));
              if (!d?.success) setMsg(d?.error ?? "Topup completion failed.");
              else {
                setMsg("Topup added successfully.");
                await fetchState();
              }
            } catch {
              setMsg("Topup completion failed.");
            }
            setBusyPlan(null);
          },
          onCancel: () => {
            setMsg("Topup payment cancelled.");
            setBusyPlan(null);
          },
          onError: () => {
            setMsg("Topup payment error.");
            setBusyPlan(null);
          },
        }
      );
    } catch {
      setMsg("Unable to start topup checkout.");
      setBusyPlan(null);
    }
  };

  const planByCode = useMemo(() => {
    const m = new Map<string, Plan>();
    for (const p of plans) m.set(p.code, p);
    return m;
  }, [plans]);
  const proPlan = planByCode.get("pro_monthly");
  const powerPlan = planByCode.get("power_monthly");
  const freePlan = planByCode.get("free");
  const getMonthlyLimit = (plan: Plan | undefined): number => {
    const raw = Number(plan?.features?.monthly_limit ?? NaN);
    if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
    return DEFAULT_LIMITS[String(plan?.code ?? "free")] ?? 0;
  };

  const overview = (
    <>
      <div className={styles.hero}>
        <div className={styles.heroTopRow}>
          <div className={styles.heroBadge}>🧠 SUPAMINDS</div>
        </div>
        <h1 className={styles.title}>Think Smarter. Move Faster. Do More.</h1>
        <p className={styles.sub}>
          Your personal AI co-pilot, built exclusively for Pi pioneers inside Supapi. Ask anything, write anything, plan anything — all without leaving your workspace.
        </p>
        <div className={styles.heroPoints}>
          <span>⚡ Instant answers</span>
          <span>🧩 Supapi-aware</span>
          <span>🔒 Pioneer-bound</span>
          <span>🌐 Always on</span>
        </div>
        <div className={styles.heroTagline}>The smartest thing in your Pi Browser.</div>
        <div className={styles.heroCtaRow}>
          <Link href="/supaminds/chat" className={styles.openChatBtn}>
            Open SupaMinds Chat →
          </Link>
        </div>
      </div>

      <div className={styles.infoSection}>
        <div className={styles.infoTitle}>What is SupaMinds?</div>
        <p className={styles.infoText}>
          SupaMinds is an assistant platform for Pioneers and builders. Use it for drafting content, planning product work,
          summarizing data, and solving tasks across your Supapi journey.
        </p>
      </div>

      <div className={styles.infoSection}>
        <div className={styles.infoTitle}>How subscription billing works</div>
          <div className={styles.rateHint}>
            {piRate > 0 ? `1 Pi ≈ $${piRate.toFixed(2)} · Live rate` : "Fetching live Pi rate..."}
          </div>
        <ul className={styles.bulletList}>
          <li>Free plan includes 12 prompts per month.</li>
          <li>Plan price is anchored to USD (stable pricing).</li>
          <li>Checkout happens in Pi using realtime Pi/USD rate.</li>
          <li>You can cancel anytime; access continues until period end.</li>
          <li>Renewal can be resumed anytime before period ends.</li>
        </ul>
      </div>
    </>
  );

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          {overview}
          <div className={styles.status}>
            <div className={styles.row}><span>Free plan</span><strong>${Number(freePlan?.price_usd ?? 0).toFixed(2)}</strong></div>
            <div className={styles.row}><span>Pro monthly</span><strong>${Number(proPlan?.price_usd ?? 12.99).toFixed(2)} {piRate > 0 ? `· π ${(Number(proPlan?.price_usd ?? 12.99) / piRate).toFixed(3)}` : ""}</strong></div>
            <div className={styles.row}><span>Power monthly</span><strong>${Number(powerPlan?.price_usd ?? 24.99).toFixed(2)} {piRate > 0 ? `· π ${(Number(powerPlan?.price_usd ?? 24.99) / piRate).toFixed(3)}` : ""}</strong></div>
            <div className={styles.muted}>Sign in to activate and manage your subscription.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        {overview}

        <div className={styles.status}>
          <div className={styles.infoTitle}>Your subscription</div>
          <div className={styles.statusGrid}>
            <div className={styles.row}><span>Current plan</span><strong>{subscription?.plan?.name ?? "Free"}</strong></div>
            <div className={styles.row}><span>Status</span><strong className={styles.statusPill}>{subscription?.status ?? "free"}</strong></div>
            <div className={styles.row}><span>Renews / ends</span><strong>{subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleString() : "-"}</strong></div>
            <div className={styles.row}><span>Cancel at period end</span><strong>{subscription?.cancel_at_period_end ? "Yes" : "No"}</strong></div>
            <div className={styles.row}><span>Topup prompt balance</span><strong>{Number(topupBalance).toLocaleString()}</strong></div>
          </div>
          <div className={styles.actionRow}>
            <button className={styles.btn} disabled={busyAction !== null} onClick={() => void postAction("cancel", "Subscription will cancel at period end.")}> {busyAction === "cancel" ? "Working..." : "Cancel anytime"} </button>
            <button className={styles.btn} disabled={busyAction !== null} onClick={() => void postAction("resume", "Auto-renew resumed.")}> {busyAction === "resume" ? "Working..." : "Resume renewal"} </button>
          </div>
        </div>

        <div className={styles.infoSection}>
          <div className={styles.infoTitle}>Plans</div>
          <div className={styles.muted}>Choose the package that fits your usage. Monthly limits are managed dynamically by current plan settings.</div>
        </div>
        <div className={styles.plans}>
          {plans.map((p) => (
            <div key={p.id} className={styles.plan}>
              <div className={styles.planName}>{p.name}</div>
              <div className={styles.planPrice}>${Number(p.price_usd ?? 0).toFixed(2)} <span className={styles.muted}>/ month</span></div>
              <div className={styles.muted}>Monthly prompts: {getMonthlyLimit(p).toLocaleString()}</div>
              {p.code !== "free" && (
                <div className={styles.planPiPrice}>
                  {piRate > 0
                    ? `≈ π ${(Number(p.price_usd ?? 0) / piRate).toFixed(3)} at current rate`
                    : "Checking live Pi price..."}
                </div>
              )}
              <div className={styles.muted}>
                {p.code === "free"
                  ? "Starter tier for everyday use with free monthly prompts"
                  : p.code === "power_monthly"
                    ? "Heavy usage tier with the highest priority and expanded limits"
                    : "Higher limits, priority responses, pro experience"}
              </div>
              <button className={styles.btn} disabled={busyPlan !== null || p.code === "free"} onClick={() => void subscribe(p.code)}>
                {busyPlan === p.code ? "Opening Pi..." : `Subscribe ${p.name}`}
              </button>
            </div>
          ))}
        </div>

        {msg && <div className={styles.msg}>{msg}</div>}
        <div className={styles.infoSection}>
          <div className={styles.infoTitle}>Topup prompts</div>
          <div className={styles.muted}>Need more prompts this month? Buy add-on packs instantly.</div>
          <div className={styles.plans}>
            {topupPacks.map((pack) => (
              <div key={pack.id} className={styles.plan}>
                <div className={styles.planName}>{pack.name}</div>
                <div className={styles.planPrice}>${Number(pack.price_usd ?? 0).toFixed(2)}</div>
                <div className={styles.muted}>+{Number(pack.prompts ?? 0).toLocaleString()} prompts</div>
                <button className={styles.btn} disabled={busyPlan !== null} onClick={() => void buyTopup(pack.code)}>
                  {busyPlan === `topup:${pack.code}` ? "Opening Pi..." : `Buy ${pack.name}`}
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.infoSection}>
          <div className={styles.infoTitle}>Assistant workspace</div>
          <p className={styles.infoText}>
            Keep billing and subscription details here, and use the dedicated workspace for prompts and chat history.
          </p>
          <Link href="/supaminds/chat" className={styles.openChatBtn}>
            Open SupaMinds Chat →
          </Link>
        </div>

        <div className={styles.infoSection}>
          <div className={styles.infoTitle}>FAQ</div>
          <div className={styles.faqItem}><strong>Can I cancel anytime?</strong><span>Yes. Cancel now and keep access until your current paid cycle ends.</span></div>
          <div className={styles.faqItem}><strong>Is free plan usable?</strong><span>Yes. Free plan includes 12 prompts per month.</span></div>
          <div className={styles.faqItem}><strong>How is Pi amount calculated?</strong><span>We convert USD plan price to Pi using live Pi/USD rate at checkout quote time.</span></div>
          <div className={styles.faqItem}><strong>Do I need Pi Browser?</strong><span>Yes, Pi payment flow requires Pi Browser for secure checkout.</span></div>
        </div>

        <div className={styles.list}>
          <div className={styles.listTitle}>Recent invoices</div>
          {invoices.map((inv) => (
            <div key={inv.id} className={styles.li}>
              <span>{new Date(inv.created_at).toLocaleString()}</span>
              <span>{inv.status}</span>
              <span>${Number(inv.amount_usd).toFixed(2)}</span>
              <span>π {Number(inv.amount_pi).toFixed(6)}</span>
            </div>
          ))}
          {!invoices.length && <div className={styles.muted}>No invoices yet.</div>}
        </div>
      </div>
    </div>
  );
}
