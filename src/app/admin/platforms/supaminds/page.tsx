"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminPageHero from "@/components/admin/AdminPageHero";
import styles from "./page.module.css";

type SubRow = {
  id: string;
  status: string;
  cancel_at_period_end?: boolean;
  current_period_end?: string;
  plan?: { code: string; name: string; price_usd: number } | null;
  user?: { username?: string; display_name?: string; email?: string } | null;
};
type PlanRow = {
  id: string;
  code: string;
  name: string;
  price_usd: number;
  active: boolean;
  features?: { monthly_limit?: number } | null;
};
type InvoiceRow = { id: string; status: string; amount_usd: number; amount_pi: number; created_at: string; paid_at?: string | null };
type UsageRow = { user_id: string; period_ym: string; plan_code: string; requests_count: number; updated_at: string };
type TopupRow = { user_id: string; prompts_total: number; prompts_used: number; prompts_remaining: number; status: string; created_at: string };
type ProviderAlert = {
  provider: string;
  level: "warn" | "info";
  message: string;
  last_seen_at: string;
  remaining_pct?: number | null;
};

// Updated to handle all plan codes including new starter + annual plans
function toPlanLabel(code?: string): string {
  const v = String(code ?? "").trim().toLowerCase();
  const map: Record<string, string> = {
    free:            "Free",
    starter_monthly: "Starter (Monthly)",
    starter_annual:  "Starter (Annual)",
    pro_monthly:     "Pro (Monthly)",
    pro_annual:      "Pro (Annual)",
    power_monthly:   "Power (Monthly)",
    power_annual:    "Power (Annual)",
  };
  return map[v] ?? (v ? v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "-");
}

export default function SupaMindsAdminPage() {
  const [token, setToken] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<SubRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [usageRows, setUsageRows] = useState<UsageRow[]>([]);
  const [topupRows, setTopupRows] = useState<TopupRow[]>([]);
  const [providerAlerts, setProviderAlerts] = useState<ProviderAlert[]>([]);
  const [stats, setStats] = useState<{
    total_subscriptions: number;
    active_subscriptions: number;
    total_revenue_usd: number;
    current_month_revenue_usd: number;
    usage_period_ym?: string | null;
    usage_requests_current_month?: number;
    usage_requests_by_plan?: Record<string, number>;
    est_ai_cost_usd_current_month?: number;
    est_profit_usd_current_month?: number;
    est_margin_pct_current_month?: number;
    model_breakdown?: { haiku?: number; sonnet?: number; opus?: number; other?: number };
    topup_prompts_sold?: number;
    topup_prompts_remaining?: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [planPriceDraft, setPlanPriceDraft] = useState<Record<string, string>>({});
  const [planLimitDraft, setPlanLimitDraft] = useState<Record<string, string>>({});
  const [cronMsg, setCronMsg] = useState("");

  useEffect(() => { setToken(localStorage.getItem("supapi_admin_token") ?? ""); }, []);

  const adminFetch = useCallback(async (url: string, opts?: RequestInit) => {
    return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ q, status });
    const r = await adminFetch(`/api/admin/supaminds?${params.toString()}`);
    const d = await r.json().catch(() => ({}));
    if (d?.success) {
      setRows(d.data.subscriptions ?? []);
      setStats(d.data.stats ?? null);
      setPlans(d.data.plans ?? []);
      setInvoices(d.data.invoices ?? []);
      setUsageRows(d.data.usage ?? []);
      setTopupRows(d.data.topups ?? []);
      setProviderAlerts(d.data.ai_runtime_alerts ?? []);
      setPlanPriceDraft(Object.fromEntries((d.data.plans ?? []).map((p: PlanRow) => [p.id, String(p.price_usd ?? "")])));
      setPlanLimitDraft(Object.fromEntries((d.data.plans ?? []).map((p: PlanRow) => [p.id, String(p.features?.monthly_limit ?? "")])));
    }
    setLoading(false);
  }, [token, q, status, adminFetch]);

  useEffect(() => { void load(); }, [load]);

  const statusOptions = useMemo(() => ["active", "past_due", "grace", "canceled", "expired"], []);

  const updateStatus = async (id: string, nextStatus: string) => {
    await adminFetch("/api/admin/supaminds", { method: "PATCH", body: JSON.stringify({ mode: "subscription_status", id, status: nextStatus }) });
    await load();
  };

  const savePlanPrice = async (id: string) => {
    const price = Number(planPriceDraft[id] ?? NaN);
    if (!Number.isFinite(price) || price < 0) return;
    await adminFetch("/api/admin/supaminds", {
      method: "PATCH",
      body: JSON.stringify({ mode: "plan_price", id, price_usd: price }),
    });
    await load();
  };

  const savePlanLimit = async (id: string) => {
    const monthlyLimit = Number(planLimitDraft[id] ?? NaN);
    if (!Number.isFinite(monthlyLimit) || monthlyLimit < 1) return;
    await adminFetch("/api/admin/supaminds", {
      method: "PATCH",
      body: JSON.stringify({ mode: "plan_limits", id, monthly_limit: Math.floor(monthlyLimit) }),
    });
    await load();
  };

  const togglePlanActive = async (id: string, currentActive: boolean) => {
    await adminFetch("/api/admin/supaminds", {
      method: "PATCH",
      body: JSON.stringify({ mode: "plan_active", id, active: !currentActive }),
    });
    await load();
  };

  const runCron = async () => {
    setCronMsg("Running...");
    const r = await adminFetch("/api/admin/supaminds", { method: "PATCH", body: JSON.stringify({ mode: "run_cron" }) });
    const d = await r.json().catch(() => ({}));
    if (!d?.success) setCronMsg(d?.error ?? "Cron failed");
    else setCronMsg(`Done: grace ${d?.data?.moved_to_grace ?? 0}, expired ${d?.data?.moved_to_expired ?? 0}`);
  };

  return (
    <div className="adminPage">
      <AdminPageHero icon="🧠" title="SupaMinds Admin" subtitle="Subscription operations and billing overview" showBadge />
      <div className={styles.wrap}>

        {/* Stats */}
        <div className={styles.stats}>
          <div className={styles.card}><div className={styles.v}>{stats?.total_subscriptions ?? 0}</div><div className={styles.k}>Total subscriptions</div></div>
          <div className={styles.card}><div className={styles.v}>{stats?.active_subscriptions ?? 0}</div><div className={styles.k}>Active subscriptions</div></div>
          <div className={styles.card}><div className={styles.v}>${Number(stats?.total_revenue_usd ?? 0).toFixed(2)}</div><div className={styles.k}>All-time revenue</div></div>
          <div className={styles.card}><div className={styles.v}>${Number(stats?.current_month_revenue_usd ?? 0).toFixed(2)}</div><div className={styles.k}>Revenue ({stats?.usage_period_ym ?? "-"})</div></div>
          <div className={styles.card}><div className={styles.v}>{Number(stats?.usage_requests_current_month ?? 0).toLocaleString()}</div><div className={styles.k}>AI requests ({stats?.usage_period_ym ?? "-"})</div></div>
          <div className={styles.card}><div className={styles.v}>${Number(stats?.est_ai_cost_usd_current_month ?? 0).toFixed(2)}</div><div className={styles.k}>Est. AI cost ({stats?.usage_period_ym ?? "-"})</div></div>
          <div className={styles.card}><div className={styles.v}>${Number(stats?.est_profit_usd_current_month ?? 0).toFixed(2)}</div><div className={styles.k}>Est. profit ({stats?.usage_period_ym ?? "-"})</div></div>
          <div className={styles.card}><div className={styles.v}>{Number(stats?.est_margin_pct_current_month ?? 0).toFixed(1)}%</div><div className={styles.k}>Gross margin ({stats?.usage_period_ym ?? "-"})</div></div>
          <div className={styles.card}><div className={styles.v}>{Number(stats?.topup_prompts_sold ?? 0).toLocaleString()}</div><div className={styles.k}>Boost prompts sold</div></div>
          <div className={styles.card}><div className={styles.v}>{Number(stats?.topup_prompts_remaining ?? 0).toLocaleString()}</div><div className={styles.k}>Boost prompts remaining</div></div>
        </div>

        {/* AI Provider Quota Alerts */}
        <div className={styles.card}>
          <div className={styles.sectionTitle}>🔔 AI Provider Quota Alerts</div>
          <div className={styles.k} style={{ marginBottom: 8 }}>
            Triggered when Anthropic or OpenAI API quota is running low. Top up at the provider dashboard before users experience errors.
          </div>
          {providerAlerts.length ? (
            <div className={styles.alertList}>
              {providerAlerts.map((a) => (
                <div key={`${a.provider}-${a.last_seen_at}`} className={styles.alertRow}>
                  <span className={styles.badge}>{a.provider}</span>
                  <span className={a.level === "warn" ? styles.warnText : styles.k}>{a.message}</span>
                  <span className={styles.k}>
                    {a.remaining_pct != null ? `(${Number(a.remaining_pct).toFixed(1)}% remaining)` : ""}
                    {" · "}{new Date(a.last_seen_at).toLocaleString()}
                  </span>
                  <a
                    href={a.provider === "anthropic" ? "https://console.anthropic.com" : "https://platform.openai.com"}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.btn}
                  >
                    Top up →
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.k}>✅ No quota alerts — all providers healthy.</div>
          )}
        </div>

        {/* Model breakdown */}
        {stats?.model_breakdown && (
          <div className={styles.card}>
            <div className={styles.sectionTitle}>Model Usage Breakdown ({stats?.usage_period_ym ?? "-"})</div>
            <div className={styles.stats}>
              <div className={styles.card}>
                <div className={styles.v}>{Number(stats.model_breakdown.haiku ?? 0).toLocaleString()}</div>
                <div className={styles.k}>Haiku requests (~$0.001/req)</div>
              </div>
              <div className={styles.card}>
                <div className={styles.v}>{Number(stats.model_breakdown.sonnet ?? 0).toLocaleString()}</div>
                <div className={styles.k}>Sonnet requests (~$0.003/req)</div>
              </div>
              <div className={styles.card}>
                <div className={styles.v}>{Number(stats.model_breakdown.opus ?? 0).toLocaleString()}</div>
                <div className={styles.k}>Opus requests (~$0.015/req)</div>
              </div>
              <div className={styles.card}>
                <div className={styles.v}>{Number(stats.model_breakdown.other ?? 0).toLocaleString()}</div>
                <div className={styles.k}>Other/OpenAI requests</div>
              </div>
            </div>
          </div>
        )}

        {/* Subscriptions table */}
        <div className={styles.card}>
          <div className={styles.filters}>
            <input className={styles.input} placeholder="Search username/email" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className={styles.btn} onClick={() => void load()}>{loading ? "Loading..." : "Refresh"}</button>
            <button className={styles.btn} onClick={() => void runCron()}>Run lifecycle cron</button>
            {cronMsg ? <span className={styles.k}>{cronMsg}</span> : null}
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Period End</th>
                <th>Auto-renew off</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>@{r.user?.username ?? "unknown"}<br />{r.user?.email ?? "-"}</td>
                  <td>{toPlanLabel(r.plan?.code)}</td>
                  <td><span className={styles.badge}>{r.status}</span></td>
                  <td>{r.current_period_end ? new Date(r.current_period_end).toLocaleString() : "-"}</td>
                  <td>{r.cancel_at_period_end ? "yes" : "no"}</td>
                  <td>
                    <select className={styles.select} value={r.status} onChange={(e) => void updateStatus(r.id, e.target.value)}>
                      {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.grid2}>
          {/* Plans management */}
          <div className={styles.card}>
            <div className={styles.sectionTitle}>Plans</div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>USD</th>
                  <th>Prompts/mo</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}<br /><span className={styles.k}>{p.code}</span></td>
                    <td>
                      <input
                        className={styles.input}
                        value={planPriceDraft[p.id] ?? ""}
                        onChange={(e) => setPlanPriceDraft((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.input}
                        value={planLimitDraft[p.id] ?? ""}
                        onChange={(e) => setPlanLimitDraft((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      />
                    </td>
                    <td>
                      <span className={p.active ? styles.activeBadge : styles.inactiveBadge}>
                        {p.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionBtns}>
                        <button className={styles.btn} onClick={() => void savePlanPrice(p.id)}>Save Price</button>
                        <button className={styles.btn} onClick={() => void savePlanLimit(p.id)}>Save Limit</button>
                        <button
                          className={p.active ? styles.btnDanger : styles.btn}
                          onClick={() => void togglePlanActive(p.id, p.active)}
                        >
                          {p.active ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recent invoices */}
          <div className={styles.card}>
            <div className={styles.sectionTitle}>Recent Invoices</div>
            <table className={styles.table}>
              <thead><tr><th>Date</th><th>Status</th><th>USD</th><th>Pi</th></tr></thead>
              <tbody>
                {invoices.slice(0, 20).map((inv) => (
                  <tr key={inv.id}>
                    <td>{new Date(inv.created_at).toLocaleString()}</td>
                    <td><span className={styles.badge}>{inv.status}</span></td>
                    <td>${Number(inv.amount_usd).toFixed(2)}</td>
                    <td>π {Number(inv.amount_pi).toFixed(6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Usage analytics */}
        <div className={styles.card}>
          <div className={styles.sectionTitle}>Usage Analytics ({stats?.usage_period_ym ?? "-"})</div>
          <div className={styles.k} style={{ marginBottom: 8 }}>
            Requests by plan:{" "}
            {Object.entries(stats?.usage_requests_by_plan ?? {}).map(([k, v]) => `${toPlanLabel(k)}: ${Number(v).toLocaleString()}`).join(" · ") || "-"}
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User ID</th>
                <th>Plan</th>
                <th>Requests</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {usageRows.slice(0, 80).map((u) => (
                <tr key={`${u.user_id}-${u.period_ym}`}>
                  <td>{u.user_id.slice(0, 8)}…</td>
                  <td>{toPlanLabel(u.plan_code)}</td>
                  <td>{Number(u.requests_count ?? 0).toLocaleString()}</td>
                  <td>{new Date(u.updated_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Boost packs ledger */}
        <div className={styles.card}>
          <div className={styles.sectionTitle}>Boost Pack Ledger</div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User ID</th>
                <th>Total</th>
                <th>Used</th>
                <th>Remaining</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {topupRows.slice(0, 80).map((t, idx) => (
                <tr key={`${t.user_id}-${t.created_at}-${idx}`}>
                  <td>{t.user_id.slice(0, 8)}…</td>
                  <td>{Number(t.prompts_total ?? 0).toLocaleString()}</td>
                  <td>{Number(t.prompts_used ?? 0).toLocaleString()}</td>
                  <td>{Number(t.prompts_remaining ?? 0).toLocaleString()}</td>
                  <td><span className={styles.badge}>{t.status}</span></td>
                  <td>{new Date(t.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
