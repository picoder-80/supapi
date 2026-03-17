"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminPageHero from "@/components/admin/AdminPageHero";
import styles from "./page.module.css";

interface TreasuryResponse {
  summary: {
    total_gross_pi: number;
    total_commission_pi: number;
    pending_payouts_pi: number;
    available_balance_pi: number;
    owner_withdrawn_pi?: number;
    available_after_owner_pi?: number;
  };
  pending_withdrawals: Array<{
    id: string;
    amount_pi: number;
    wallet_address: string;
    status: string;
    requested_at: string;
    admin_note: string | null;
    seller?: { username?: string; display_name?: string | null };
  }>;
  recent_withdrawals: Array<{
    id: string;
    amount_pi: number;
    status: string;
    pi_txid: string | null;
    processed_at: string | null;
    seller?: { username?: string };
  }>;
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

export default function PlatformAdminPage() {
  const [token, setToken] = useState("");
  const [period, setPeriod] = useState<"all" | "month" | "week">("all");
  const [loading, setLoading] = useState(true);
  const [treasury, setTreasury] = useState<TreasuryResponse | null>(null);
  const [msg, setMsg] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [ownerAmount, setOwnerAmount] = useState("");
  const [ownerTxid, setOwnerTxid] = useState("");
  const [ownerNote, setOwnerNote] = useState("");
  const [ownerDestinationWallet, setOwnerDestinationWallet] = useState("");
  const [ownerExecuteTransfer, setOwnerExecuteTransfer] = useState(false);
  const [ownerSubmitting, setOwnerSubmitting] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem("supapi_admin_token") ?? "");
  }, []);

  const fetchTreasury = async (p: "all" | "month" | "week") => {
    if (!token) return;
    setLoading(true);
    setMsg("");
    try {
      const r = await fetch(`/api/admin/treasury?period=${p}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.success) setTreasury(d.data);
      else setMsg(d.error ?? "Failed to load treasury");
    } catch {
      setMsg("Failed to load treasury");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchTreasury(period);
  }, [token, period]);

  const quickStats = useMemo(() => {
    const s = treasury?.summary;
    if (!s) return null;
    return [
      { label: "Available Balance", value: `${Number(s.available_balance_pi).toFixed(4)} π` },
      { label: "Pending Payouts", value: `${Number(s.pending_payouts_pi).toFixed(4)} π` },
      { label: "Total Commission", value: `${Number(s.total_commission_pi).toFixed(4)} π` },
      { label: "Total GMV", value: `${Number(s.total_gross_pi).toFixed(4)} π` },
    ];
  }, [treasury]);

  const ownerWithdraw = async () => {
    if (!token) return;
    const amount = Number.parseFloat(ownerAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMsg("❌ Enter valid withdrawal amount");
      return;
    }
    if (!ownerExecuteTransfer && !ownerTxid.trim()) {
      setMsg("❌ Enter Pi txid");
      return;
    }
    if (ownerExecuteTransfer && !ownerDestinationWallet.trim()) {
      setMsg("❌ Enter destination wallet for execute transfer");
      return;
    }
    setOwnerSubmitting(true);
    setMsg("");
    try {
      const r = await fetch("/api/admin/treasury", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "owner_withdraw",
          amount_pi: amount,
          pi_txid: ownerExecuteTransfer ? null : ownerTxid.trim(),
          admin_note: ownerNote.trim() || null,
          execute_transfer: ownerExecuteTransfer,
          destination_wallet: ownerExecuteTransfer ? ownerDestinationWallet.trim() : null,
        }),
      });
      const d = await r.json();
      if (d.success) {
        setMsg(ownerExecuteTransfer ? "✅ Owner transfer executed + recorded" : "✅ Owner withdrawal recorded");
        setOwnerAmount("");
        setOwnerTxid("");
        setOwnerNote("");
        setOwnerDestinationWallet("");
        await fetchTreasury(period);
      } else {
        setMsg(`❌ ${d.error ?? "Owner withdrawal failed"}`);
      }
    } catch {
      setMsg("❌ Owner withdrawal failed");
    } finally {
      setOwnerSubmitting(false);
    }
  };

  const processWithdrawal = async (id: string, action: "pay" | "reject") => {
    if (!token) return;
    setProcessingId(id);
    setMsg("");
    try {
      const payload =
        action === "pay"
          ? { withdrawal_id: id, action: "pay", pi_txid: `manual-${Date.now()}`, admin_note: "Processed from Treasury panel" }
          : { withdrawal_id: id, action: "reject", admin_note: "Rejected from Treasury panel" };

      const r = await fetch("/api/admin/treasury", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (d.success) {
        setMsg(action === "pay" ? "✅ Withdrawal marked paid" : "✅ Withdrawal rejected");
        await fetchTreasury(period);
      } else {
        setMsg(`❌ ${d.error ?? "Process failed"}`);
      }
    } catch {
      setMsg("❌ Process failed");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="adminPage">
      <AdminPageHero
        icon="💰"
        title="Treasury Wallet"
        subtitle="Monitor commission health, manage payout queues, and run treasury operations"
      />

      <div className="adminSection">
        <div className={styles.topRow}>
          <div className={styles.periodWrap}>
            <button className={`${styles.periodBtn} ${period==="week" ? styles.periodBtnActive : ""}`} onClick={() => setPeriod("week")}>7d</button>
            <button className={`${styles.periodBtn} ${period==="month" ? styles.periodBtnActive : ""}`} onClick={() => setPeriod("month")}>Month</button>
            <button className={`${styles.periodBtn} ${period==="all" ? styles.periodBtnActive : ""}`} onClick={() => setPeriod("all")}>All</button>
          </div>
        </div>

        {loading && <div className={styles.cardSub}>Loading treasury data...</div>}
        {!loading && msg && <div className={styles.msg}>{msg}</div>}

        {quickStats && (
          <div className={styles.statGrid}>
            {quickStats.map((s) => (
              <div key={s.label} className={styles.statCard}>
                <div className={styles.statLabel}>{s.label}</div>
                <div className={styles.statValue}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.panel} style={{ marginBottom: 12 }}>
          <div className={styles.panelTitle}>Owner Withdraw to Personal Pi Wallet</div>
          <div className={styles.cardSub}>
            Available after owner withdrawals: π {Number(treasury?.summary.available_after_owner_pi ?? 0).toFixed(4)} ·
            Total owner withdrawn: π {Number(treasury?.summary.owner_withdrawn_pi ?? 0).toFixed(4)}
          </div>
          <div className={styles.cardSub}>
            {ownerExecuteTransfer
              ? "Execute Transfer mode (structure ready): backend will call external payout API if configured."
              : "Record-only mode: accounting update only, no automatic blockchain transfer."}
          </div>
          <div className={styles.rowActions} style={{ marginBottom: 8, flexWrap: "wrap" }}>
            <input
              className={styles.textInput}
              type="number"
              step="0.0001"
              min="0"
              placeholder="Amount π"
              value={ownerAmount}
              onChange={(e) => setOwnerAmount(e.target.value)}
            />
            {!ownerExecuteTransfer ? (
              <input
                className={styles.textInput}
                placeholder="Pi txid"
                value={ownerTxid}
                onChange={(e) => setOwnerTxid(e.target.value)}
              />
            ) : (
              <input
                className={styles.textInput}
                placeholder="Destination wallet address"
                value={ownerDestinationWallet}
                onChange={(e) => setOwnerDestinationWallet(e.target.value)}
              />
            )}
            <input
              className={styles.textInput}
              placeholder="Note (optional)"
              value={ownerNote}
              onChange={(e) => setOwnerNote(e.target.value)}
            />
            <button
              className={styles.dangerBtn}
              type="button"
              onClick={() => setOwnerExecuteTransfer((v) => !v)}
            >
              {ownerExecuteTransfer ? "Switch to Record-only" : "Switch to Execute Transfer"}
            </button>
            <button className={styles.okBtn} disabled={ownerSubmitting} onClick={ownerWithdraw}>
              {ownerSubmitting
                ? ownerExecuteTransfer ? "Executing..." : "Recording..."
                : ownerExecuteTransfer ? "Execute Transfer + Record" : "Record Owner Withdrawal"}
            </button>
          </div>
        </div>

        <div className={styles.splitGrid}>
          <div className={styles.panel}>
            <div className={styles.panelTitle}>Pending Payout Queue</div>
            {treasury?.pending_withdrawals?.length ? treasury.pending_withdrawals.map((w) => (
              <div key={w.id} className={styles.row}>
                <div className={styles.rowInfo}>
                  <div className={styles.rowTitle}>@{w.seller?.username ?? "seller"} · {Number(w.amount_pi).toFixed(4)} π</div>
                  <div className={styles.rowSub}>{fmtDate(w.requested_at)} · {w.wallet_address || "No wallet addr"}</div>
                </div>
                <div className={styles.rowActions}>
                  <button className={styles.okBtn} disabled={processingId === w.id} onClick={() => processWithdrawal(w.id, "pay")}>Pay</button>
                  <button className={styles.dangerBtn} disabled={processingId === w.id} onClick={() => processWithdrawal(w.id, "reject")}>Reject</button>
                </div>
              </div>
            )) : <div className={styles.empty}>No pending withdrawals 🎉</div>}
          </div>

          <div className={styles.panel}>
            <div className={styles.panelTitle}>Recent Processed</div>
            {treasury?.recent_withdrawals?.length ? treasury.recent_withdrawals.map((w) => (
              <div key={w.id} className={styles.row}>
                <div className={styles.rowInfo}>
                  <div className={styles.rowTitle}>@{w.seller?.username ?? "seller"} · {Number(w.amount_pi).toFixed(4)} π</div>
                  <div className={styles.rowSub}>{fmtDate(w.processed_at)} · {w.pi_txid ?? "no txid"}</div>
                </div>
                <span className={`${styles.badge} ${w.status === "paid" ? styles.badgeOk : styles.badgeWarn}`}>{w.status}</span>
              </div>
            )) : <div className={styles.empty}>No processed withdrawals yet</div>}
          </div>
        </div>
      </div>

      <div className="adminQuickLinks">
        <Link href="/admin/dashboard" className="adminBackBtn">Back to Dashboard</Link>
      </div>
    </div>
  );
}