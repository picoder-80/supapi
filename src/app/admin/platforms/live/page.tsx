"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminPageHero from "@/components/admin/AdminPageHero";
import styles from "./page.module.css";

type LivePlan = {
  id: string;
  code: string;
  name: string;
  price_usd: number;
  plan_type: string;
  active: boolean;
  features: Record<string, unknown>;
  updated_at: string;
};

type LiveSession = {
  id: string;
  user_id: string;
  title: string | null;
  status: string;
  plan_type: string;
  viewer_count: number;
  like_count: number;
  comment_count: number;
  started_at: string;
  ended_at: string | null;
  cf_stream_id: string | null;
  user?: { username: string; display_name: string | null };
};

type LiveSubscription = {
  id: string;
  user_id: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_start: string;
  current_period_end: string;
  canceled_at: string | null;
  plan?: { code: string; name: string; price_usd: number } | null;
  user?: { username: string; display_name: string | null; email: string } | null;
};

type LiveInvoice = {
  id: string;
  status: string;
  amount_usd: number;
  amount_pi: number;
  paid_at: string | null;
  created_at: string;
};

type Stats = {
  total_sessions: number;
  active_sessions_now: number;
  total_revenue_usd: number;
  current_month_revenue_usd: number;
  session_revenue_usd: number;
  monthly_revenue_usd: number;
  total_monthly_subscribers: number;
  active_monthly_subscribers: number;
  total_invoices_paid: number;
};

export default function AdminLivePage() {
  const [token, setToken] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [plans, setPlans] = useState<LivePlan[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [subscriptions, setSubscriptions] = useState<LiveSubscription[]>([]);
  const [invoices, setInvoices] = useState<LiveInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  useEffect(() => { setToken(localStorage.getItem("supapi_admin_token") ?? ""); }, []);

  const adminFetch = useCallback(async (url: string, opts?: RequestInit) => {
    return fetch(url, {
      ...opts,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ q, status: statusFilter });
    const r = await adminFetch(`/api/admin/live?${params}`);
    const d = await r.json().catch(() => ({}));
    if (d?.success) {
      setStats(d.data.stats ?? null);
      setPlans(d.data.plans ?? []);
      setSessions(d.data.sessions ?? []);
      setSubscriptions(d.data.subscriptions ?? []);
      setInvoices(d.data.invoices ?? []);
      setPriceDraft(Object.fromEntries((d.data.plans ?? []).map((p: LivePlan) => [p.id, String(p.price_usd)])));
    }
    setLoading(false);
  }, [token, q, statusFilter, adminFetch]);

  useEffect(() => { void load(); }, [load]);

  const patch = async (body: Record<string, unknown>, successMsg: string) => {
    setMsg("");
    const r = await adminFetch("/api/admin/live", { method: "PATCH", body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (d?.success) { setMsg(successMsg); await load(); }
    else setMsg(d?.error ?? "Action failed");
  };

  const savePlanPrice = (id: string) => {
    const price = Number(priceDraft[id] ?? NaN);
    if (!Number.isFinite(price) || price < 0) { setMsg("Invalid price"); return; }
    void patch({ mode: "plan_price", id, price_usd: price }, "Price updated successfully.");
  };

  const togglePlanActive = (id: string, current: boolean) =>
    void patch({ mode: "plan_active", id, active: !current }, `Plan ${current ? "disabled" : "enabled"}.`);

  const endSession = (id: string) =>
    void patch({ mode: "end_session", id }, "Session ended.");

  const cancelSubscription = (id: string) =>
    void patch({ mode: "cancel_subscription", id }, "Subscription cancelled.");

  const extendSubscription = (id: string) =>
    void patch({ mode: "extend_subscription", id }, "Subscription extended by 30 days.");

  const activeSessions = useMemo(() => sessions.filter(s => s.status === "live"), [sessions]);

  const ym = new Date().toISOString().slice(0, 7);

  return (
    <div className="adminPage">
      <AdminPageHero icon="🔴" title="SupaLive Admin" subtitle="Live streaming operations, dynamic pricing, and revenue" showBadge />
      <div className={styles.wrap}>

        {/* Stats */}
        <div className={styles.stats}>
          <div className={styles.card}><div className={styles.v}>{stats?.total_sessions ?? 0}</div><div className={styles.k}>Total sessions</div></div>
          <div className={styles.card}>
            <div className={styles.v} style={{ color: activeSessions.length > 0 ? "#e53e3e" : "#1a1a2e" }}>
              {stats?.active_sessions_now ?? 0}
            </div>
            <div className={styles.k}>🔴 Live now</div>
          </div>
          <div className={styles.card}><div className={styles.v}>${Number(stats?.total_revenue_usd ?? 0).toFixed(2)}</div><div className={styles.k}>All-time revenue</div></div>
          <div className={styles.card}><div className={styles.v}>${Number(stats?.current_month_revenue_usd ?? 0).toFixed(2)}</div><div className={styles.k}>Revenue ({ym})</div></div>
          <div className={styles.card}><div className={styles.v}>${Number(stats?.session_revenue_usd ?? 0).toFixed(2)}</div><div className={styles.k}>Session fees revenue</div></div>
          <div className={styles.card}><div className={styles.v}>${Number(stats?.monthly_revenue_usd ?? 0).toFixed(2)}</div><div className={styles.k}>Monthly plan revenue</div></div>
          <div className={styles.card}><div className={styles.v}>{stats?.active_monthly_subscribers ?? 0}</div><div className={styles.k}>Active monthly subscribers</div></div>
          <div className={styles.card}><div className={styles.v}>{stats?.total_invoices_paid ?? 0}</div><div className={styles.k}>Total invoices paid</div></div>
        </div>

        {msg && <div className={styles.msgBox}>{msg}</div>}

        {/* Dynamic Pricing — Plans Management */}
        <div className={styles.card}>
          <div className={styles.sectionTitle}>💰 Dynamic Pricing — Live Plans</div>
          <div className={styles.k} style={{ marginBottom: 10 }}>
            Changes apply immediately — next user to go live will be charged the new price.
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Type</th>
                <th>Current Price (USD)</th>
                <th>New Price (USD)</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong><br /><span className={styles.k}>{p.code}</span></td>
                  <td><span className={styles.badge}>{p.plan_type}</span></td>
                  <td><strong>${Number(p.price_usd).toFixed(2)}</strong></td>
                  <td>
                    <input
                      className={styles.input}
                      style={{ width: 80 }}
                      value={priceDraft[p.id] ?? ""}
                      onChange={(e) => setPriceDraft(prev => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder="0.00"
                    />
                  </td>
                  <td>
                    <span className={p.active ? styles.activeBadge : styles.inactiveBadge}>
                      {p.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className={styles.k}>{new Date(p.updated_at).toLocaleString()}</td>
                  <td>
                    <div className={styles.actionBtns}>
                      <button className={styles.btnGold} onClick={() => savePlanPrice(p.id)}>
                        Save Price
                      </button>
                      <button
                        className={p.active ? styles.btnDanger : styles.btn}
                        onClick={() => togglePlanActive(p.id, p.active)}
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

        {/* Active Sessions Monitor */}
        {activeSessions.length > 0 && (
          <div className={styles.card}>
            <div className={styles.sectionTitle}>🔴 Live Now — {activeSessions.length} active</div>
            <table className={styles.table}>
              <thead>
                <tr><th>Host</th><th>Title</th><th>Plan</th><th>Viewers</th><th>Started</th><th>Action</th></tr>
              </thead>
              <tbody>
                {activeSessions.map((s) => (
                  <tr key={s.id}>
                    <td>@{s.user?.username ?? "unknown"}</td>
                    <td>{s.title ?? "-"}</td>
                    <td><span className={styles.badge}>{s.plan_type}</span></td>
                    <td>{s.viewer_count}</td>
                    <td className={styles.k}>{new Date(s.started_at).toLocaleString()}</td>
                    <td>
                      <button className={styles.btnDanger} onClick={() => endSession(s.id)}>
                        Force End
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sessions History */}
        <div className={styles.card}>
          <div className={styles.sectionTitle}>📋 Sessions History</div>
          <div className={styles.filters}>
            <input
              className={styles.input}
              placeholder="Search username / title"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className={styles.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="live">Live</option>
              <option value="ended">Ended</option>
            </select>
            <button className={styles.btn} onClick={() => void load()}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Host</th>
                <th>Title</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Viewers</th>
                <th>Started</th>
                <th>Ended</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sessions.slice(0, 100).map((s) => (
                <tr key={s.id}>
                  <td>@{s.user?.username ?? "unknown"}</td>
                  <td>{s.title ?? "-"}</td>
                  <td><span className={styles.badge}>{s.plan_type}</span></td>
                  <td>
                    <span className={s.status === "live" ? styles.liveBadge : styles.badge}>
                      {s.status}
                    </span>
                  </td>
                  <td>{s.viewer_count}</td>
                  <td className={styles.k}>{new Date(s.started_at).toLocaleString()}</td>
                  <td className={styles.k}>{s.ended_at ? new Date(s.ended_at).toLocaleString() : "-"}</td>
                  <td>
                    {s.status === "live" && (
                      <button className={styles.btnDanger} onClick={() => endSession(s.id)}>End</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.grid2}>
          {/* Monthly Subscriptions */}
          <div className={styles.card}>
            <div className={styles.sectionTitle}>♾️ Monthly Subscribers</div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Period End</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.slice(0, 50).map((s) => (
                  <tr key={s.id}>
                    <td>
                      @{s.user?.username ?? "unknown"}<br />
                      <span className={styles.k}>{s.user?.email ?? "-"}</span>
                    </td>
                    <td>
                      <span className={s.status === "active" ? styles.activeBadge : styles.inactiveBadge}>
                        {s.status}
                      </span>
                    </td>
                    <td className={styles.k}>
                      {s.current_period_end ? new Date(s.current_period_end).toLocaleString() : "-"}
                    </td>
                    <td>
                      <div className={styles.actionBtns}>
                        <button className={styles.btn} onClick={() => extendSubscription(s.id)}>
                          +30 days
                        </button>
                        {s.status === "active" && (
                          <button className={styles.btnDanger} onClick={() => cancelSubscription(s.id)}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!subscriptions.length && <tr><td colSpan={4} className={styles.k}>No subscribers yet.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Recent Invoices */}
          <div className={styles.card}>
            <div className={styles.sectionTitle}>🧾 Recent Invoices</div>
            <table className={styles.table}>
              <thead>
                <tr><th>Date</th><th>Status</th><th>USD</th><th>Pi</th></tr>
              </thead>
              <tbody>
                {invoices.slice(0, 30).map((inv) => (
                  <tr key={inv.id}>
                    <td className={styles.k}>{new Date(inv.created_at).toLocaleString()}</td>
                    <td><span className={inv.status === "paid" ? styles.activeBadge : styles.badge}>{inv.status}</span></td>
                    <td>${Number(inv.amount_usd).toFixed(2)}</td>
                    <td>π {Number(inv.amount_pi).toFixed(4)}</td>
                  </tr>
                ))}
                {!invoices.length && <tr><td colSpan={4} className={styles.k}>No invoices yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
