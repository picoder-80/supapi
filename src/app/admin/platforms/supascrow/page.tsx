"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminPageHero from "@/components/admin/AdminPageHero";
import styles from "./page.module.css";

type Deal = {
  id: string;
  title: string;
  amount_pi: number;
  currency: string;
  status: string;
  buyer_id: string;
  seller_id: string;
  tracking_number?: string;
  tracking_carrier?: string;
  created_at: string;
  updated_at: string;
  buyer?: { id: string; username: string; display_name: string | null };
  seller?: { id: string; username: string; display_name: string | null };
};

type Dispute = {
  id: string;
  deal_id: string;
  initiator_id: string;
  reason: string | null;
  resolution: string | null;
  resolved_at: string | null;
  ai_decision: string | null;
  ai_reasoning: string | null;
  ai_confidence: number | null;
  created_at: string;
  deal: (Deal & { title: string }) | null;
  initiator?: { id: string; username: string; display_name: string | null };
};

type SupaScrowSummary = {
  total_deals: number;
  open_disputes: number;
  status_counts: Record<string, number>;
  total_escrow_pi: number;
  funded_escrow_pi: number;
  released_escrow_pi: number;
  refunded_escrow_pi: number;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_LABELS: Record<string, string> = {
  created: "Created",
  accepted: "Accepted",
  funded: "Funded",
  shipped: "Shipped",
  delivered: "Delivered",
  released: "Released",
  disputed: "Disputed",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

export default function AdminSupaScrowPage() {
  const [token, setToken] = useState("");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [totalDeals, setTotalDeals] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [loadingDeals, setLoadingDeals] = useState(true);
  const [loadingDisputes, setLoadingDisputes] = useState(true);
  const [msg, setMsg] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"deals" | "disputes" | null>(null);
  const [openDisputesTotal, setOpenDisputesTotal] = useState(0);
  const [commPct, setCommPct] = useState("");
  const [commTotal, setCommTotal] = useState(0);
  const [summary, setSummary] = useState<SupaScrowSummary>({
    total_deals: 0,
    open_disputes: 0,
    status_counts: {},
    total_escrow_pi: 0,
    funded_escrow_pi: 0,
    released_escrow_pi: 0,
    refunded_escrow_pi: 0,
  });
  const [savingComm, setSavingComm] = useState(false);
  const [commMsg, setCommMsg] = useState("");

  useEffect(() => {
    setToken(localStorage.getItem("supapi_admin_token") ?? "");
  }, []);

  const fetchDeals = async () => {
    if (!token) return;
    setLoadingDeals(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter) params.set("status", statusFilter);
      const r = await fetch(`/api/admin/supascrow/deals?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.success) {
        setDeals(d.data.deals ?? []);
        setTotalDeals(d.data.total ?? 0);
        if (d.data.summary) setSummary(d.data.summary);
      } else setMsg(d.error ?? "Failed to load deals");
    } catch {
      setMsg("Failed to load deals");
    } finally {
      setLoadingDeals(false);
    }
  };

  const fetchDisputes = async () => {
    if (!token) return;
    setLoadingDisputes(true);
    try {
      const r = await fetch("/api/admin/supascrow/disputes?status=open", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.success) {
        setDisputes(d.data.disputes ?? []);
        setOpenDisputesTotal(Number(d.data.total ?? (d.data.disputes ?? []).length));
      } else {
        setDisputes([]);
        setOpenDisputesTotal(0);
        setMsg(d.error ?? "Failed to load disputes");
      }
    } catch {
      setDisputes([]);
      setOpenDisputesTotal(0);
      setMsg("Failed to load disputes");
    } finally {
      setLoadingDisputes(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchDeals();
  }, [token, statusFilter]);

  useEffect(() => {
    if (!token) return;
    fetchDisputes();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/admin/supascrow/commission`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setCommPct(String(d.data.commission_pct));
          setCommTotal(d.data.total_commission_pi ?? 0);
        }
      });
  }, [token]);

  const saveCommission = async () => {
    const pct = parseFloat(commPct);
    if (isNaN(pct) || pct < 0 || pct > 50) {
      setCommMsg("Enter 0–50");
      return;
    }
    setSavingComm(true);
    setCommMsg("");
    try {
      const r = await fetch("/api/admin/supascrow/commission", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ commission_pct: pct }),
      });
      const d = await r.json();
      setCommMsg(d.success ? "✅ Saved!" : `❌ ${d.error ?? "Failed"}`);
      setTimeout(() => setCommMsg(""), 2500);
    } catch {
      setCommMsg("❌ Request failed");
    } finally {
      setSavingComm(false);
    }
  };

  const resolveDispute = async (disputeId: string, resolution: "release_to_seller" | "refund_to_buyer") => {
    if (!token || resolvingId) return;
    setResolvingId(disputeId);
    setMsg("");
    try {
      const r = await fetch(`/api/admin/supascrow/disputes/${disputeId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resolution }),
      });
      const d = await r.json();
      if (d.success) {
        setMsg(`✅ ${d.data?.message ?? "Done"}`);
        await Promise.all([fetchDeals(), fetchDisputes()]);
      } else setMsg(`❌ ${d.error ?? "Failed"}`);
    } catch {
      setMsg("❌ Request failed");
    } finally {
      setResolvingId(null);
    }
  };

  const openDisputes = disputes;

  const exportCSV = async (type: "deals" | "disputes") => {
    if (!token || exporting) return;
    setExporting(type);
    try {
      const r = await fetch(`/api/admin/supascrow/export?type=${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `supascrow_${type}_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMsg("Export failed");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="adminPage">
      <AdminPageHero
        icon="🛡️"
        title="SupaScrow"
        subtitle="Monitor escrow deals and resolve disputes"
      />

      {!!msg && <div className={styles.msg}>{msg}</div>}

      <section className="adminSection">
        <h2 className={styles.sectionTitle}>Escrow Stats</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 6 }}>
          <div className="adminCard">
            <div className="adminCardLabel">Commission Rate</div>
            <div className="adminCardValue">{commPct || "0"}%</div>
            <div className="adminCardSub">Pi deals only</div>
          </div>
          <div className="adminCard">
            <div className="adminCardLabel">Commission Collected</div>
            <div className="adminCardValue">π {Number(commTotal).toFixed(4)}</div>
            <div className="adminCardSub">from released Pi deals</div>
          </div>
          <div className="adminCard">
            <div className="adminCardLabel">Total Deals</div>
            <div className="adminCardValue">{Number(summary.total_deals).toFixed(0)}</div>
            <div className="adminCardSub">
              {Number(summary.status_counts.created ?? 0).toFixed(0)} created · {Number(summary.status_counts.accepted ?? 0).toFixed(0)} accepted
            </div>
          </div>
          <div className="adminCard">
            <div className="adminCardLabel">Funded Deals</div>
            <div className="adminCardValue">{Number(summary.status_counts.funded ?? 0).toFixed(0)}</div>
            <div className="adminCardSub">π {Number(summary.funded_escrow_pi ?? 0).toFixed(4)} funded escrow</div>
          </div>
          <div className="adminCard">
            <div className="adminCardLabel">Open Disputes</div>
            <div className="adminCardValue">{Number(summary.open_disputes).toFixed(0)}</div>
            <div className="adminCardSub">{Number(summary.status_counts.disputed ?? 0).toFixed(0)} deals currently disputed</div>
          </div>
          <div className="adminCard">
            <div className="adminCardLabel">Total Escrow (Pi)</div>
            <div className="adminCardValue">π {Number(summary.total_escrow_pi ?? 0).toFixed(4)}</div>
            <div className="adminCardSub">all Pi deals value</div>
          </div>
          <div className="adminCard">
            <div className="adminCardLabel">Released (Pi)</div>
            <div className="adminCardValue">π {Number(summary.released_escrow_pi ?? 0).toFixed(4)}</div>
            <div className="adminCardSub">{Number(summary.status_counts.released ?? 0).toFixed(0)} deals released</div>
          </div>
          <div className="adminCard">
            <div className="adminCardLabel">Refunded (Pi)</div>
            <div className="adminCardValue">π {Number(summary.refunded_escrow_pi ?? 0).toFixed(4)}</div>
            <div className="adminCardSub">{Number(summary.status_counts.refunded ?? 0).toFixed(0)} deals refunded</div>
          </div>
        </div>
      </section>

      <section className="adminSection">
        <h2 className={styles.sectionTitle}>Commission (Pi deals only)</h2>
        <div className={styles.commRow}>
          <div className={styles.commStat}>
            <span className={styles.commLabel}>Current rate</span>
            <span className={styles.commValue}>{commPct || "—"}%</span>
          </div>
          <div className={styles.commStat}>
            <span className={styles.commLabel}>Total collected</span>
            <span className={styles.commValue}>π {Number(commTotal).toFixed(4)}</span>
          </div>
          <div className={styles.commEdit}>
            <input
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={commPct}
              onChange={(e) => setCommPct(e.target.value)}
              className={styles.commInput}
              placeholder="5"
            />
            <span className={styles.commPctLabel}>%</span>
            <button className={styles.saveCommBtn} onClick={saveCommission} disabled={savingComm}>
              {savingComm ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
        {commMsg && <div className={styles.commMsg}>{commMsg}</div>}
        <div className={styles.commNote}>Commission deducted from seller payout on Pi release. SC deals: no commission. Range: 0–50%.</div>
      </section>

      <section className="adminSection">
        <div className={styles.disputeHeaderRow}>
          <h2 className={styles.sectionTitle}>Open Disputes</h2>
          <span className={styles.disputeCountBadge}>{openDisputesTotal} open</span>
        </div>
        {loadingDisputes ? (
          <div className={styles.empty}>Loading…</div>
        ) : openDisputes.length === 0 ? (
          <div className={styles.empty}>No open disputes</div>
        ) : (
          <div className={styles.disputeList}>
            {openDisputes.map((d) => {
              const aiSuggestsRefund = d.ai_decision === "refund";
              const aiSuggestsRelease = d.ai_decision === "release";
              const canApplyAi = (aiSuggestsRefund || aiSuggestsRelease) && !resolvingId;
              return (
                <div key={d.id} className={styles.disputeCard}>
                  <div className={styles.disputeHead}>
                    <span className={styles.disputeDealTitle}>{d.deal?.title ?? "Deal"}</span>
                    <span className={styles.disputeMeta}>
                      {d.deal?.currency === "sc" ? "💎" : "π"} {Number(d.deal?.amount_pi ?? 0).toLocaleString()} · Initiated by @{d.initiator?.username ?? "?"}
                    </span>
                  </div>
                  {d.reason && <div className={styles.disputeReason}>{d.reason}</div>}
                  {d.ai_decision && (
                    <div className={styles.aiSuggestion}>
                      <span className={styles.aiLabel}>Suggested resolution:</span>{" "}
                      {d.ai_decision === "manual_review"
                        ? "Manual review"
                        : d.ai_decision === "refund"
                          ? "Refund buyer"
                          : "Release to seller"}
                      {d.ai_confidence != null && (
                        <span className={styles.aiConf}> · {(Number(d.ai_confidence) * 100).toFixed(0)}% confidence</span>
                      )}
                      {d.ai_reasoning && <div className={styles.aiReasoning}>{d.ai_reasoning}</div>}
                    </div>
                  )}
                  <div className={styles.disputeActions}>
                    {canApplyAi && (
                      <button
                        className={styles.btnApplyAi}
                        onClick={() => resolveDispute(d.id, aiSuggestsRefund ? "refund_to_buyer" : "release_to_seller")}
                        disabled={!!resolvingId}
                      >
                        {resolvingId === d.id ? "…" : "Apply suggestion"}
                      </button>
                    )}
                    <button
                      className={styles.btnRelease}
                      onClick={() => resolveDispute(d.id, "release_to_seller")}
                      disabled={!!resolvingId}
                    >
                      {resolvingId === d.id ? "…" : "Release to seller"}
                    </button>
                    <button
                      className={styles.btnRefund}
                      onClick={() => resolveDispute(d.id, "refund_to_buyer")}
                      disabled={!!resolvingId}
                    >
                      {resolvingId === d.id ? "…" : "Refund to buyer"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="adminSection">
        <div className={styles.filterRow}>
          <h2 className={styles.sectionTitle}>All Deals ({totalDeals})</h2>
          <div className={styles.exportRow}>
            <button
              type="button"
              className={styles.exportBtn}
              onClick={() => exportCSV("deals")}
              disabled={!!exporting}
            >
              {exporting === "deals" ? "…" : "Export deals CSV"}
            </button>
            <button
              type="button"
              className={styles.exportBtn}
              onClick={() => exportCSV("disputes")}
              disabled={!!exporting}
            >
              {exporting === "disputes" ? "…" : "Export disputes CSV"}
            </button>
          </div>
          <select
            className={styles.select}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        {loadingDeals ? (
          <div className={styles.empty}>Loading…</div>
        ) : deals.length === 0 ? (
          <div className={styles.empty}>No deals found</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Title</th>
                  <th>Amount</th>
                  <th>Buyer</th>
                  <th>Seller</th>
                  <th>Status</th>
                  <th>Tracking</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((row) => (
                  <tr key={row.id}>
                    <td>{fmtDate(row.created_at)}</td>
                    <td>{row.title}</td>
                    <td>{row.currency === "sc" ? "💎" : "π"} {Number(row.amount_pi).toLocaleString()}</td>
                    <td>@{row.buyer?.username ?? "?"}</td>
                    <td>@{row.seller?.username ?? "?"}</td>
                    <td><span className={styles.statusBadge} data-status={row.status}>{STATUS_LABELS[row.status] ?? row.status}</span></td>
                    <td>{row.tracking_number ? `${row.tracking_carrier ?? ""} ${row.tracking_number}`.trim() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="adminQuickLinks">
        <Link href="/admin/dashboard" className="adminBackBtn">Back to Dashboard</Link>
      </div>
    </div>
  );
}
