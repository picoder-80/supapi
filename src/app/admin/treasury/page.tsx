"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AdminPageHero from "@/components/admin/AdminPageHero";

const PLATFORM_EMOJI: Record<string, string> = {
  market: "🛍️", gigs: "💼", endoro: "🚗",
  domus: "🏠", bulkhub: "📦", supascrow: "🛡️", default: "🪐",
};

const PLATFORM_LABEL: Record<string, string> = {
  market: "SupaMarket", gigs: "SupaSkil", endoro: "SupaEndoro",
  domus: "SupaDomus", bulkhub: "SupaBulk", supascrow: "SupaScrow",
};

interface TreasurySummary {
  total_gross_pi: number;
  total_commission_pi: number;
  pending_payouts_pi: number;
  available_balance_pi: number;
}

interface PendingWithdrawal {
  id: string;
  amount_pi: number;
  wallet_address: string | null;
  status: string;
  requested_at: string;
  seller: { id: string; username: string; display_name: string; wallet_address: string | null };
}

interface TreasuryData {
  period: string;
  summary: TreasurySummary;
  by_platform: Record<string, { gross: number; commission: number; count: number }>;
  monthly_trend: Record<string, number>;
  pending_withdrawals: PendingWithdrawal[];
  recent_withdrawals: Array<{ id: string; amount_pi: number; status: string; pi_txid: string; processed_at: string; seller: { username: string } }>;
  commission_configs: Array<{ key: string; value: string }>;
}

export default function AdminTreasuryPage() {
  const router   = useRouter();
  const [data, setData]       = useState<TreasuryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState("all");

  // Pay modal state
  const [payModal, setPayModal]   = useState<PendingWithdrawal | null>(null);
  const [txid, setTxid]           = useState("");
  const [note, setNote]           = useState("");
  const [processing, setProcessing] = useState(false);
  const [rejectId, setRejectId]   = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const token = () => typeof window !== "undefined" ? localStorage.getItem("supapi_admin_token") ?? "" : "";

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/treasury?period=${period}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (d.success) setData(d.data);
      else router.push("/admin/login");
    } catch {}
    setLoading(false);
  }, [period, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePay = async () => {
    if (!payModal || !txid.trim()) return;
    setProcessing(true);
    try {
      const r = await fetch("/api/admin/treasury", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ withdrawal_id: payModal.id, action: "pay", pi_txid: txid.trim(), admin_note: note }),
      });
      const d = await r.json();
      if (d.success) {
        setPayModal(null); setTxid(""); setNote("");
        await fetchData();
      } else alert(d.error ?? "Failed");
    } catch { alert("Network error"); }
    setProcessing(false);
  };

  const handleReject = async (id: string) => {
    setProcessing(true);
    try {
      const r = await fetch("/api/admin/treasury", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ withdrawal_id: id, action: "reject", admin_note: rejectNote }),
      });
      const d = await r.json();
      if (d.success) { setRejectId(null); setRejectNote(""); await fetchData(); }
      else alert(d.error ?? "Failed");
    } catch { alert("Network error"); }
    setProcessing(false);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1A1A2E,#0F3460)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "rgba(255,255,255,0.5)" }}>Loading treasury...</span>
    </div>
  );

  if (!data) return null;

  const { summary, by_platform, monthly_trend, pending_withdrawals, recent_withdrawals, commission_configs } = data;
  const months = Object.entries(monthly_trend).sort(([a], [b]) => a.localeCompare(b)).slice(-6);

  return (
    <div className="adminPage">
      <AdminPageHero
        icon="💰"
        title="Treasury Overview"
        subtitle="Revenue, commission, and payout management"
      />

      <div className="adminSection">
        <div className="adminSectionRow">
          <h2 className="adminSectionTitle"><span className="adminSectionIcon">📅</span> Period</h2>
          <div style={{ display: "flex", gap: 8 }}>
            {["all","month","week"].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{
                  padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600,
                  background: period === p ? "var(--color-gold)" : "var(--color-bg)",
                  color: period === p ? "#1a1a2e" : "var(--color-text-muted)",
                  border: period !== p ? "1px solid var(--color-border)" : "none",
                }}
              >
                {p === "all" ? "All Time" : p === "month" ? "This Month" : "This Week"}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginTop: 16, marginBottom: 20 }}>
          {[
            { label: "Total Revenue", value: summary.total_gross_pi, primary: false, warn: false, sub: "gross from all platforms" },
            { label: "Supapi Commission", value: summary.total_commission_pi, primary: true, warn: false, sub: "your earnings" },
            { label: "Pending Payouts", value: summary.pending_payouts_pi, primary: false, warn: true, sub: "owed to sellers" },
            { label: "Available Balance", value: summary.available_balance_pi, primary: true, warn: false, sub: "commission − payouts" },
          ].map(c => (
            <div key={c.label} className={`adminCard ${c.primary && !c.warn ? "adminCardPrimary" : ""}`}>
              <div className="adminCardLabel">{c.label}</div>
              <div className={`adminCardValue ${c.warn ? "adminCardValueWarn" : ""}`}>π {c.value.toFixed(4)}</div>
              <div className="adminCardSub">{c.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Platform Breakdown */}
      <div className="adminSection">
          <div className="adminSectionTitle"><span className="adminSectionIcon">📊</span> Revenue by Platform</div>
          {Object.entries(by_platform).length === 0 && (
            <div style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "20px 0" }}>No revenue recorded yet</div>
          )}
          {Object.entries(by_platform).map(([platform, stats]) => (
            <div key={platform} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
              <div style={{ fontSize: 22 }}>{PLATFORM_EMOJI[platform] ?? PLATFORM_EMOJI.default}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E" }}>{PLATFORM_LABEL[platform] ?? platform}</div>
                <div style={{ fontSize: 11, color: "#718096" }}>{stats.count} orders · π{stats.gross.toFixed(4)} gross</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#F5A623" }}>π {stats.commission.toFixed(4)}</div>
                <div style={{ fontSize: 10, color: "#aaa" }}>commission</div>
              </div>
            </div>
          ))}
      </div>

      {/* Monthly Trend */}
      {months.length > 0 && (
        <div className="adminSection">
            <div className="adminSectionTitle"><span className="adminSectionIcon">📈</span> Monthly Commission (Last 6 Months)</div>
            {months.map(([month, amount]) => {
              const max = Math.max(...months.map(([,v]) => v), 0.001);
              const pct = (amount / max) * 100;
              return (
                <div key={month} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "#718096" }}>{month}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#1A1A2E" }}>π {amount.toFixed(4)}</span>
                  </div>
                  <div style={{ background: "#F8F9FD", borderRadius: 4, height: 8 }}>
                    <div style={{ background: "#F5A623", borderRadius: 4, height: 8, width: `${pct}%`, transition: "width 0.5s" }} />
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Commission Rates */}
      <div className="adminSection">
          <div className="adminSectionTitle"><span className="adminSectionIcon">%</span> Commission Rates</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {commission_configs.filter(c => c.key.startsWith("commission_")).map(c => {
              const platform = c.key.replace("commission_", "");
              return (
                <div key={c.key} style={{ background: "#F8F9FD", borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{PLATFORM_EMOJI[platform] ?? "🪐"}</span>
                  <span style={{ fontSize: 12, color: "#718096" }}>{PLATFORM_LABEL[platform] ?? platform}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#F5A623" }}>{c.value}%</span>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 10 }}>
            To update rates → Admin Market Commission settings
        </div>
      </div>

      {/* Pending Withdrawals */}
      <div className="adminSection">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div className="adminSectionTitle" style={{ marginBottom: 0 }}>
              Pending Withdrawals
              {pending_withdrawals.length > 0 && (
                <span style={{ marginLeft: 8, background: "#e74c3c", color: "#fff", borderRadius: 10, padding: "2px 8px", fontSize: 11 }}>
                  {pending_withdrawals.length}
                </span>
              )}
            </div>
          </div>

          {pending_withdrawals.length === 0 ? (
            <div style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "20px 0" }}>✅ No pending withdrawals</div>
          ) : pending_withdrawals.map(w => (
            <div key={w.id} style={{ border: "1px solid #E2E8F0", borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E" }}>@{w.seller?.username}</div>
                  <div style={{ fontSize: 11, color: "#718096" }}>
                    {new Date(w.requested_at).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#e74c3c" }}>π {Number(w.amount_pi).toFixed(4)}</div>
              </div>

              {/* Wallet address */}
              <div style={{ background: "#F8F9FD", borderRadius: 8, padding: "8px 10px", marginBottom: 10, fontFamily: "monospace", fontSize: 11, color: "#718096", wordBreak: "break-all" }}>
                <span style={{ color: "#aaa" }}>Wallet: </span>
                {w.seller?.wallet_address ?? w.wallet_address ?? "⚠️ No wallet address"}
              </div>

              {/* Reject expand */}
              {rejectId === w.id ? (
                <div>
                  <textarea placeholder="Reason for rejection (optional)"
                    value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                    rows={2} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12, marginBottom: 8, boxSizing: "border-box", resize: "none" }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleReject(w.id)} disabled={processing}
                      style={{ flex: 1, background: "#e74c3c", color: "#fff", border: "none", borderRadius: 8, padding: "8px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      {processing ? "..." : "Confirm Reject"}
                    </button>
                    <button onClick={() => setRejectId(null)}
                      style={{ flex: 1, background: "#F8F9FD", color: "#718096", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 0", fontSize: 12, cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setPayModal(w); setTxid(""); setNote(""); }}
                    style={{ flex: 2, background: "#F5A623", color: "#1A1A2E", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    ✅ Mark as Paid
                  </button>
                  <button onClick={() => { setRejectId(w.id); setRejectNote(""); }}
                    style={{ flex: 1, background: "#fff", color: "#e74c3c", border: "1px solid #e74c3c", borderRadius: 8, padding: "10px 0", fontSize: 12, cursor: "pointer" }}>
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
      </div>

      {/* Recent Processed */}
      {recent_withdrawals.length > 0 && (
        <div className="adminSection">
            <div className="adminSectionTitle"><span className="adminSectionIcon">✅</span> Recent Processed</div>
            {recent_withdrawals.map(w => (
              <div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1A1A2E" }}>@{w.seller?.username}</div>
                  <div style={{ fontSize: 11, color: "#aaa" }}>{w.processed_at ? new Date(w.processed_at).toLocaleDateString() : ""}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: w.status === "paid" ? "#27ae60" : "#e74c3c" }}>
                    {w.status === "paid" ? "✅" : "❌"} π{Number(w.amount_pi).toFixed(4)}
                  </div>
                  {w.pi_txid && <div style={{ fontSize: 10, color: "#aaa", fontFamily: "monospace" }}>{w.pi_txid.slice(0,12)}...</div>}
                </div>
              </div>
            ))}
        </div>
      )}

      <div className="adminQuickLinks">
        <Link href="/admin/dashboard" className="adminBackBtn">Back to Dashboard</Link>
      </div>

      {/* Pay Modal */}
      {payModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end" }}
          onClick={() => !processing && setPayModal(null)}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: "#E2E8F0", borderRadius: 2, margin: "0 auto 20px" }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1A2E", marginBottom: 4 }}>Mark Withdrawal as Paid</div>
            <div style={{ fontSize: 13, color: "#718096", marginBottom: 20 }}>
              @{payModal.seller?.username} · <strong>π {Number(payModal.amount_pi).toFixed(4)}</strong>
            </div>

            <div style={{ background: "#F8F9FD", borderRadius: 10, padding: "10px 12px", marginBottom: 16, fontFamily: "monospace", fontSize: 11, color: "#718096", wordBreak: "break-all" }}>
              <div style={{ color: "#aaa", marginBottom: 4 }}>Send to wallet:</div>
              {payModal.seller?.wallet_address ?? payModal.wallet_address ?? "⚠️ No wallet address on file"}
            </div>

            <div style={{ fontSize: 12, color: "#718096", marginBottom: 6 }}>Pi Transaction ID (txid) *</div>
            <input placeholder="e.g. abc123def456..."
              value={txid} onChange={e => setTxid(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 13, marginBottom: 12, boxSizing: "border-box", fontFamily: "monospace" }} />

            <div style={{ fontSize: 12, color: "#718096", marginBottom: 6 }}>Admin Note (optional)</div>
            <input placeholder="e.g. Processed via Pi App"
              value={note} onChange={e => setNote(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 13, marginBottom: 20, boxSizing: "border-box" }} />

            <button onClick={handlePay} disabled={processing || !txid.trim()}
              style={{ width: "100%", background: txid.trim() ? "#F5A623" : "#E2E8F0", color: txid.trim() ? "#1A1A2E" : "#aaa",
                border: "none", borderRadius: 12, padding: "14px 0", fontSize: 15, fontWeight: 700, cursor: txid.trim() ? "pointer" : "not-allowed" }}>
              {processing ? "Processing..." : "✅ Confirm Payment"}
            </button>
            <button onClick={() => setPayModal(null)} disabled={processing}
              style={{ width: "100%", background: "none", border: "none", color: "#718096", padding: "12px 0", fontSize: 13, cursor: "pointer", marginTop: 4 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
