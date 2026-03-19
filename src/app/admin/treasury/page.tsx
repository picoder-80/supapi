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
  owner_withdrawn_pi?: number;
  available_after_owner_pi?: number;
}

interface PendingWithdrawal {
  id: string;
  amount_pi: number;
  wallet_address: string | null;
  status: string;
  requested_at: string;
  seller: { id: string; username: string; display_name: string; wallet_address: string | null };
}

interface OwnerWithdrawal {
  id: string;
  amount_pi: number;
  pi_txid: string | null;
  recipient_uid: string | null;
  admin_note: string | null;
  execute_transfer: boolean;
  created_at: string;
}

interface TreasuryData {
  period: string;
  admin_user?: { username: string; pi_uid: string } | null;
  summary: TreasurySummary;
  by_platform: Record<string, { gross: number; commission: number; count: number }>;
  platform_display?: Record<string, { label: string; emoji: string }>;
  monthly_trend: Record<string, number>;
  pending_withdrawals: PendingWithdrawal[];
  recent_withdrawals: Array<{ id: string; amount_pi: number; status: string; pi_txid: string; processed_at: string; seller: { username: string } }>;
  commission_configs: Array<{ key: string; value: string; platform: string; label: string; emoji: string }>;
  owner_withdrawals?: OwnerWithdrawal[];
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

  // Treasury Withdrawal (owner) state
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawWallet, setWithdrawWallet] = useState("");
  const [withdrawUsername, setWithdrawUsername] = useState("");
  const [withdrawNote, setWithdrawNote] = useState("");
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipients, setRecipients] = useState<Array<{ username: string; display_name: string; pi_uid: string }>>([]);
  const [recipientOpen, setRecipientOpen] = useState(false);

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

  // Auto-fill admin's pi_uid when data loads (owner withdrawing to self)
  useEffect(() => {
    if (data?.admin_user?.pi_uid && !withdrawWallet) {
      setWithdrawWallet(data.admin_user.pi_uid);
      setWithdrawUsername(data.admin_user.username ? `@${data.admin_user.username}` : "");
    }
  }, [data?.admin_user?.pi_uid, data?.admin_user?.username]);

  // Search recipients by username
  useEffect(() => {
    if (!recipientSearch.trim()) {
      setRecipients([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/admin/treasury/recipients?q=${encodeURIComponent(recipientSearch)}`, {
        headers: { Authorization: `Bearer ${token()}` },
      })
        .then(r => r.json())
        .then(d => {
          if (d.success) setRecipients(d.data ?? []);
          else setRecipients([]);
        })
        .catch(() => setRecipients([]));
    }, 300);
    return () => clearTimeout(t);
  }, [recipientSearch]);

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

  const handleOwnerWithdraw = async () => {
    const amount = Number.parseFloat(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setWithdrawMsg("Enter a valid amount");
      return;
    }
    setWithdrawSubmitting(true);
    setWithdrawMsg("");
    try {
      const r = await fetch("/api/admin/treasury", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          action: "owner_withdraw",
          amount_pi: amount,
          execute_transfer: true,
          pi_txid: null,
          admin_note: withdrawNote.trim() || null,
        }),
      });
      const d = await r.json();
      if (d.success) {
        setWithdrawMsg("✅ " + (d.message ?? "Withdrawal recorded"));
        setWithdrawAmount("");
        setWithdrawNote("");
        await fetchData();
      } else {
        setWithdrawMsg(d.error ?? "Withdrawal failed");
      }
    } catch {
      setWithdrawMsg("Network error");
    }
    setWithdrawSubmitting(false);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1A1A2E,#0F3460)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "rgba(255,255,255,0.5)" }}>Loading treasury...</span>
    </div>
  );

  if (!data) return null;

  const { summary, by_platform, platform_display = {}, monthly_trend, pending_withdrawals, recent_withdrawals, owner_withdrawals = [], commission_configs } = data;
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
            { label: "Total Withdrawal", value: summary.owner_withdrawn_pi ?? 0, primary: false, warn: false, sub: "owner treasury withdrawals" },
            { label: "Available Balance", value: summary.available_after_owner_pi ?? summary.available_balance_pi, primary: true, warn: false, sub: "commission − payouts − withdrawn" },
          ].map(c => (
            <div key={c.label} className={`adminCard ${c.primary && !c.warn ? "adminCardPrimary" : ""}`}>
              <div className="adminCardLabel">{c.label}</div>
              <div className={`adminCardValue ${c.warn ? "adminCardValueWarn" : ""}`}>π {c.value.toFixed(4)}</div>
              <div className="adminCardSub">{c.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Treasury Withdrawal — Owner withdraw via Pi A2U */}
      <div className="adminSection">
        <div className="adminSectionTitle">
          <span className="adminSectionIcon">💸</span> Treasury Withdrawal
        </div>
        <div className="adminCardSub" style={{ marginBottom: 16 }}>
          Available For Withdrawals: π {Number(summary.available_after_owner_pi ?? summary.available_balance_pi).toFixed(4)}
          <br />
          Total Withdrawn: π {Number(summary.owner_withdrawn_pi ?? 0).toFixed(4)}
        </div>
        {withdrawMsg && (
          <div className="adminMsg" style={{ marginBottom: 12, background: withdrawMsg.startsWith("✅") ? "rgba(39,174,96,0.08)" : "rgba(231,76,60,0.08)", borderColor: withdrawMsg.startsWith("✅") ? "rgba(39,174,96,0.3)" : "rgba(231,76,60,0.3)" }}>
            {withdrawMsg}
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ minWidth: 120 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>Amount (π)</label>
            <input
              type="number"
              step="0.0001"
              min="0"
              placeholder="0.00"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="adminInput"
              style={{ width: 120 }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>Recipient (Pi username)</label>
            <input
              type="text"
              value="@wandy80"
              disabled
              className="adminInput"
              style={{ width: "100%", background: "var(--color-bg)", color: "var(--color-text-muted)" }}
            />
          </div>
          <div style={{ minWidth: 140 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>Note (optional)</label>
            <input
              type="text"
              placeholder="e.g. Monthly withdrawal"
              value={withdrawNote}
              onChange={(e) => setWithdrawNote(e.target.value)}
              className="adminInput"
            />
          </div>
          <button
            type="button"
            className="adminPrimaryBtn"
            disabled={withdrawSubmitting}
            onClick={handleOwnerWithdraw}
          >
            {withdrawSubmitting ? "Processing…" : "Withdraw via Pi A2U"}
          </button>
        </div>
        {/* Treasury Withdrawal Transactions */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
          <div className="adminSectionTitle" style={{ marginBottom: 12 }}>
            <span className="adminSectionIcon">📜</span> Treasury Withdrawal Transactions
          </div>
          {owner_withdrawals.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", padding: "6px 0" }}>No treasury withdrawals yet</div>
          ) : (
            <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: 10, background: "var(--color-bg)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 0.9fr", gap: 8, padding: "9px 10px", borderBottom: "1px solid var(--color-border)", fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                <div>Date / Mode</div>
                <div>Amount / Recipient</div>
                <div>Transaction</div>
              </div>
              {owner_withdrawals.map((w) => (
                <div key={w.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 0.9fr", gap: 8, padding: "9px 10px", borderBottom: "1px solid rgba(0,0,0,0.05)", fontSize: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "#1A1A2E" }}>
                      {new Date(w.created_at).toLocaleString("en-MY", { dateStyle: "short", timeStyle: "short" })}
                    </div>
                    <div style={{ fontSize: 11, color: "#718096" }}>
                      {w.execute_transfer ? "Pi A2U" : "Record-only"}
                      {w.admin_note ? ` · ${w.admin_note}` : ""}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: "#1A1A2E" }}>π {Number(w.amount_pi).toFixed(4)}</div>
                    <div style={{ fontSize: 11, color: "#718096", fontFamily: "monospace" }}>
                      {w.recipient_uid ? `${w.recipient_uid.slice(0, 12)}...` : "—"}
                    </div>
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 11, color: "#718096" }}>
                    {w.pi_txid ? `${w.pi_txid.slice(0, 14)}...` : "pending"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Platform Breakdown */}
      <div className="adminSection">
          <div className="adminSectionTitle"><span className="adminSectionIcon">📊</span> Revenue by Platform</div>
          {Object.entries(by_platform).length === 0 && (
            <div style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "20px 0" }}>No revenue recorded yet</div>
          )}
          {Object.entries(by_platform).map(([platform, stats]) => {
            const display = platform_display[platform];
            return (
            <div key={platform} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
              <div style={{ fontSize: 22 }}>{display?.emoji ?? PLATFORM_EMOJI[platform] ?? PLATFORM_EMOJI.default}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E" }}>{display?.label ?? PLATFORM_LABEL[platform] ?? platform}</div>
                <div style={{ fontSize: 11, color: "#718096" }}>{stats.count} orders · π{stats.gross.toFixed(4)} gross</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#F5A623" }}>π {stats.commission.toFixed(4)}</div>
                <div style={{ fontSize: 10, color: "#aaa" }}>commission</div>
              </div>
            </div>
          );
          })}
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

      {/* Commission Rates — from platform_config (dynamic) */}
      <div className="adminSection">
          <div className="adminSectionTitle"><span className="adminSectionIcon">%</span> Commission Rates</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {commission_configs.map(c => (
              <div key={c.key} style={{ background: "#F8F9FD", borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                <span>{c.emoji}</span>
                <span style={{ fontSize: 12, color: "#718096" }}>{c.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#F5A623" }}>{c.value}%</span>
              </div>
            ))}
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

      {/* Pay Modal — SupaCredit-style */}
      {payModal && (
        <div className="adminModalOverlay" onClick={() => !processing && setPayModal(null)}>
          <div className="adminModalSheet" onClick={e => e.stopPropagation()}>
            <div className="adminModalHandle" />
            <div className="adminModalEmoji">💸</div>
            <div className="adminModalTitle">Mark Withdrawal as Paid</div>
            <div className="adminModalSub">@{payModal.seller?.username} · π {Number(payModal.amount_pi).toFixed(4)}</div>

            <div className="adminModalInfo">
              <div className="adminModalRow">
                <span className="adminModalRowLabel">Send to wallet</span>
                <span className="adminModalRowVal" style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>
                  {payModal.seller?.wallet_address ?? payModal.wallet_address ?? "⚠️ No wallet address on file"}
                </span>
              </div>
            </div>

            <label className="adminModalLabel">Pi Transaction ID (txid) *</label>
            <input
              className="adminModalInput"
              placeholder="e.g. abc123def456..."
              value={txid}
              onChange={e => setTxid(e.target.value)}
              style={{ fontFamily: "monospace" }}
            />

            <label className="adminModalLabel">Admin Note (optional)</label>
            <input
              className="adminModalInput"
              placeholder="e.g. Processed via Pi App"
              value={note}
              onChange={e => setNote(e.target.value)}
            />

            <div className="adminModalBtns">
              <button className="adminModalCancelBtn" onClick={() => setPayModal(null)} disabled={processing}>
                Cancel
              </button>
              <button className="adminModalConfirmBtn" onClick={handlePay} disabled={processing || !txid.trim()}>
                {processing ? "Processing..." : "✅ Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
