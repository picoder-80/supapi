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

const ANNUAL_DISCOUNT = 0.20;

const PLAN_META: Record<string, { prompts: number; description: string; highlight?: boolean }> = {
  free:           { prompts: 50,    description: "Try SupaMinds with 50 free prompts every month." },
  starter_monthly:{ prompts: 300,   description: "Great for casual users and light daily use." },
  pro_monthly:    { prompts: 1000,  description: "Higher limits, priority responses, pro experience.", highlight: true },
  power_monthly:  { prompts: 3000,  description: "Heavy usage tier with the highest priority and expanded limits." },
  starter_annual: { prompts: 300,   description: "Great for casual users and light daily use." },
  pro_annual:     { prompts: 1000,  description: "Higher limits, priority responses, pro experience.", highlight: true },
  power_annual:   { prompts: 3000,  description: "Heavy usage tier with the highest priority and expanded limits." },
};

function annualMonthly(price: number) {
  return Number((price * (1 - ANNUAL_DISCOUNT)).toFixed(2));
}

function PlanCheckoutHints({ priceUsd, piRate }: { priceUsd: number; piRate: number }) {
  const usd = Number(priceUsd ?? 0);
  return (
    <>
      <div className={styles.planPiPrice}>
        {piRate > 0 ? `≈ π ${(usd / piRate).toFixed(3)} at current rate` : "Checking live Pi price..."}
      </div>
      <div className={styles.planPiRateLine}>
        {piRate > 0 ? `1 Pi ≈ $${piRate.toFixed(2)} USD · Live rate` : "Fetching live Pi rate..."}
      </div>
      <div className={styles.planPackageNote}>
        💡 Rate updates live · Pay with Pi in Pi Browser
      </div>
    </>
  );
}

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
  const [isAnnual, setIsAnnual] = useState(false);

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
    const timer = window.setInterval(() => { void loadPiRate(); }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const subscribe = async (planCode: string) => {
    if (!user || !token) return;
    if (!isPiBrowser()) { setMsg("Open in Pi Browser to subscribe."); return; }
    setBusyPlan(planCode);
    setMsg("");
    try {
      const quoteRes = await fetch("/api/supaminds/subscription/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan_code: planCode }),
      });
      const quote = await quoteRes.json().catch(() => ({}));
      if (!quote?.success) { setMsg(quote?.error ?? "Failed to create quote"); setBusyPlan(null); return; }
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
              if (!d?.success) setMsg(d?.error ?? "Payment completion failed.");
              else { setMsg("Subscription activated."); await fetchState(); }
            } catch { setMsg("Payment completion failed."); }
            setBusyPlan(null);
          },
          onCancel: () => { setMsg("Payment cancelled."); setBusyPlan(null); },
          onError: () => { setMsg("Payment error."); setBusyPlan(null); },
        }
      );
    } catch { setMsg("Unable to start checkout."); setBusyPlan(null); }
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
        if (r.status === 404) { lastErr = "Endpoint not found"; continue; }
        if (!d?.success) { lastErr = String(d?.error ?? "Action failed"); break; }
        done = true;
        break;
      }
      if (!done) setMsg(lastErr);
      else { setMsg(successMsg); await fetchState(); }
    } catch { setMsg("Action failed"); }
    setBusyAction(null);
  };

  const buyTopup = async (packCode: string) => {
    if (!user || !token) return;
    if (!isPiBrowser()) { setMsg("Open in Pi Browser to buy a boost pack."); return; }
    setBusyPlan(`topup:${packCode}`);
    setMsg("");
    try {
      const quoteRes = await fetch("/api/supaminds/subscription/topup/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pack_code: packCode }),
      });
      const quote = await quoteRes.json().catch(() => ({}));
      if (!quote?.success) { setMsg(quote?.error ?? "Failed to create quote"); setBusyPlan(null); return; }
      const invoice = quote.data.invoice as Invoice;
      await ensurePaymentReady();
      createPiPayment(
        {
          amount: Number(invoice.amount_pi),
          memo: `SupaMinds boost pack ${packCode}`,
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
              if (!d?.success) setMsg(d?.error ?? "Boost pack purchase failed.");
              else { setMsg("Boost prompts added successfully."); await fetchState(); }
            } catch { setMsg("Boost pack purchase failed."); }
            setBusyPlan(null);
          },
          onCancel: () => { setMsg("Payment cancelled."); setBusyPlan(null); },
          onError: () => { setMsg("Payment error."); setBusyPlan(null); },
        }
      );
    } catch { setMsg("Unable to start checkout."); setBusyPlan(null); }
  };

  const staticPlans = [
    { code: "free",    name: "Free",    monthly: 0,     annual: 0 },
    { code: "starter", name: "Starter", monthly: 4.99,  annual: annualMonthly(4.99) },
    { code: "pro",     name: "Pro",     monthly: 12.99, annual: annualMonthly(12.99) },
    { code: "power",   name: "Power",   monthly: 24.99, annual: annualMonthly(24.99) },
  ];

  const getPlanCode = (base: string) => {
    if (base === "free") return "free";
    return isAnnual ? `${base}_annual` : `${base}_monthly`;
  };

  const overview = (
    <>
      <div className={styles.hero}>
        <div className={styles.heroTopRow}>
          <div className={styles.heroBadge}>🧠 SUPAMINDS</div>
        </div>
        <h1 className={styles.title}>Your Mind, Supercharged.</h1>
        <p className={styles.sub}>
          The AI built for Pi Pioneers. Ask boldly. Build faster. Think bigger — all inside Supapi.
        </p>
        <div className={styles.heroPoints}>
          <span>🧠 Pioneer AI</span>
          <span>⚡ Instant answers</span>
          <span>🚀 Built for builders</span>
          <span>🔒 Pi-native</span>
        </div>
        <div className={styles.heroTagline}>Where Pi Pioneers come to think.</div>
        <div className={styles.heroCtaRow}>
          <Link href="/supaminds/chat" className={styles.openChatBtn}>
            Open SupaMinds Chat →
          </Link>
        </div>
      </div>

      <div className={styles.infoSection}>
        <div className={styles.infoTitle}>What is SupaMinds?</div>
        <p className={styles.infoText}>
          SupaMinds is the AI that thinks with you, not for you. Ask hard questions, get sharp answers, move faster than everyone else — all inside your Pi ecosystem.
        </p>
      </div>

      {/* Billing toggle */}
      <div className={styles.infoSection}>
        <div className={styles.billingToggleRow}>
          <span className={styles.infoTitle}>Choose your plan</span>
          <div className={styles.toggleWrap}>
            <button
              className={`${styles.toggleBtn} ${!isAnnual ? styles.toggleActive : ""}`}
              onClick={() => setIsAnnual(false)}
            >
              Monthly
            </button>
            <button
              className={`${styles.toggleBtn} ${isAnnual ? styles.toggleActive : ""}`}
              onClick={() => setIsAnnual(true)}
            >
              Annual
              <span className={styles.saveBadge}>Save 20%</span>
            </button>
          </div>
        </div>
        {isAnnual && (
          <div className={styles.annualNote}>
            💡 Annual plans are billed as a single upfront payment. Pi amount is calculated at checkout using the live rate.
          </div>
        )}
        <div className={styles.rateHint}>
          {piRate > 0 ? `1 Pi ≈ $${piRate.toFixed(2)} · Live rate` : "Fetching live Pi rate..."}
        </div>
      </div>

      {/* Plans grid */}
      <div className={styles.plans}>
        {staticPlans.map((p) => {
          const displayPrice = isAnnual ? p.annual : p.monthly;
          const planCode = getPlanCode(p.code);
          const meta = PLAN_META[planCode] ?? PLAN_META[`${p.code}_monthly`];
          const isFree = p.code === "free";
          const isHighlight = meta?.highlight;
          return (
            <div key={p.code} className={`${styles.plan} ${isHighlight ? styles.planHighlight : ""}`}>
              {isHighlight && <div className={styles.popularBadge}>⭐ Most Popular</div>}
              <div className={styles.planName}>{p.name}</div>
              <div className={styles.planPrice}>
                {isFree ? "Free" : `$${displayPrice.toFixed(2)}`}
                {!isFree && <span className={styles.muted}> / {isAnnual ? "mo, billed annually" : "month"}</span>}
              </div>
              {!isFree && isAnnual && (
                <div className={styles.annualSaving}>
                  Save ${((p.monthly - p.annual) * 12).toFixed(0)}/year vs monthly
                </div>
              )}
              <div className={styles.muted}>{meta?.prompts.toLocaleString()} prompts / month</div>
              {!isFree && <PlanCheckoutHints priceUsd={isAnnual ? p.annual * 12 : displayPrice} piRate={piRate} />}
              <div className={styles.muted}>{meta?.description}</div>
              <button
                className={`${styles.btn} ${isHighlight ? styles.btnHighlight : ""}`}
                disabled={busyPlan !== null || isFree}
                onClick={() => void subscribe(planCode)}
              >
                {busyPlan === planCode ? "Opening Pi..." : isFree ? "Current plan" : `Get ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>

      <div className={styles.infoSection}>
        <div className={styles.infoTitle}>How billing works</div>
        <ul className={styles.bulletList}>
          <li>Free plan includes 50 prompts per month — no payment required.</li>
          <li>Plan prices are anchored to USD for stable, predictable pricing.</li>
          <li>Checkout is completed in Pi using the real-time Pi/USD rate.</li>
          <li>Annual plans are billed as one upfront payment — 20% cheaper than monthly.</li>
          <li>You can cancel anytime; access continues until the end of your billing period.</li>
        </ul>
      </div>
    </>
  );

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>{overview}</div>
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
            <div className={styles.row}><span>Auto-renew off</span><strong>{subscription?.cancel_at_period_end ? "Yes" : "No"}</strong></div>
            <div className={styles.row}><span>Boost prompt balance</span><strong>{Number(topupBalance).toLocaleString()}</strong></div>
          </div>
          <div className={styles.actionRow}>
            <button className={styles.btnOutlineDanger} disabled={busyAction !== null} onClick={() => void postAction("cancel", "Subscription will cancel at period end.")}>
              {busyAction === "cancel" ? "Working..." : "Cancel anytime"}
            </button>
            <button className={`${styles.btn} ${styles.btnFullWidth}`} disabled={busyAction !== null} onClick={() => void postAction("resume", "Auto-renewal resumed.")}>
              {busyAction === "resume" ? "Working..." : "Resume renewal"}
            </button>
          </div>
        </div>

        {msg && <div className={styles.msg}>{msg}</div>}

        <div className={styles.infoSection}>
          <div className={styles.infoTitle}>⚡ Prompt Boost Packs</div>
          <p className={styles.infoText}>
            Running low on prompts? Top up instantly — no subscription needed. Available for all plans including Free.
          </p>
          <div className={styles.boostGrid}>
            {topupPacks.map((pack) => {
              const priceUsd = Number(pack.price_usd ?? 0);
              const prompts = Number(pack.prompts ?? 0);
              const centsPerPrompt = prompts > 0 ? ((priceUsd / prompts) * 100).toFixed(1) : "0";
              const emoji = pack.code === "boost_mini" ? "🔋" : pack.code === "boost_smart" ? "⚡" : "🚀";
              return (
                <div key={pack.id} className={styles.boostCard}>
                  <div className={styles.boostEmoji}>{emoji}</div>
                  <div className={styles.boostName}>{pack.name}</div>
                  <div className={styles.boostPrompts}>+{prompts.toLocaleString()} prompts</div>
                  <div className={styles.boostPrice}>${priceUsd.toFixed(2)}</div>
                  <div className={styles.muted}>{centsPerPrompt}¢ per prompt</div>
                  <PlanCheckoutHints priceUsd={priceUsd} piRate={piRate} />
                  <button
                    className={styles.btn}
                    disabled={busyPlan !== null}
                    onClick={() => void buyTopup(pack.code)}
                  >
                    {busyPlan === `topup:${pack.code}` ? "Opening Pi..." : `Get ${pack.name}`}
                  </button>
                </div>
              );
            })}
          </div>
          <div className={styles.boostNote}>
            💡 Boost prompts never expire and stack on top of your monthly allowance.
          </div>
        </div>

        <div className={styles.infoSection}>
          <div className={styles.infoTitle}>Assistant workspace</div>
          <p className={styles.infoText}>Manage your billing here, and head to the chat workspace for prompts and conversation history.</p>
          <Link href="/supaminds/chat" className={styles.openChatBtn}>Open SupaMinds Chat →</Link>
        </div>

        <div className={styles.infoSection}>
          <div className={styles.infoTitle}>FAQ</div>
          <div className={styles.faqItem}><strong>Can I cancel anytime?</strong><span>Yes. Cancel now and keep access until your current billing period ends.</span></div>
          <div className={styles.faqItem}><strong>Is the free plan usable?</strong><span>Yes. The free plan includes 50 prompts per month at no cost.</span></div>
          <div className={styles.faqItem}><strong>How is the Pi amount calculated?</strong><span>We convert the USD plan price to Pi using the live Pi/USD rate at the time of checkout.</span></div>
          <div className={styles.faqItem}><strong>Do I need Pi Browser?</strong><span>Yes. Pi payments require the Pi Browser for a secure checkout experience.</span></div>
          <div className={styles.faqItem}><strong>What is the annual plan?</strong><span>Pay for 12 months upfront and save 20% compared to the monthly rate. Same features, better value.</span></div>
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
