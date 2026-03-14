"use client";

// app/admin/dashboard/page.tsx

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

interface TreasuryData {
  summary: {
    total_gross_pi: number;
    total_commission_pi: number;
    pending_payouts_pi: number;
    available_balance_pi: number;
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
interface SCWalletData {
  summary: {
    total_balance: number;
    total_earned: number;
    total_spent: number;
    active_wallets: number;
    total_wallets: number;
  };
  recent_transactions: Array<{
    id: string;
    type: string;
    activity: string;
    amount: number;
    created_at: string;
    user: { username?: string } | null;
  }>;
}
interface ReferralStatsData {
  total_referrals: number;
  active_referrers: number;
  total_earnings_pi: number;
  pending_pi: number;
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-MY", { day:"numeric", month:"short" });
}

// Safe fetch — never throws, returns null on error
async function safeFetch(url: string, token: string): Promise<any> {
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const text = await r.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function AdminDashboardPage() {
  const [treasury,   setTreasury]   = useState<TreasuryData | null>(null);
  const [scWallet, setScWallet] = useState<SCWalletData | null>(null);
  const [referralStats, setReferralStats] = useState<ReferralStatsData | null>(null);
  const [period, setPeriod] = useState<"all" | "month" | "week">("all");
  const [loading,    setLoading]    = useState(true);
  const [msg, setMsg] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("supapi_admin_token") ?? "";
    setLoading(true);
    setMsg("");
    Promise.all([
      safeFetch(`/api/admin/treasury?period=${period}`, token),
      safeFetch("/api/admin/sc-wallet?limit=8", token),
      safeFetch("/api/admin/referral?type=stats", token),
    ])
      .then(([t, sc, rs]) => {
      if (t?.success) setTreasury(t.data);
      else setMsg("Failed to load treasury.");
      if (sc?.success) setScWallet(sc.data);
      if (rs?.success) setReferralStats(rs.data);
      })
      .finally(() => setLoading(false));
  }, [period]);

  const processWithdrawal = async (id: string, action: "pay" | "reject") => {
    const token = localStorage.getItem("supapi_admin_token") ?? "";
    if (!token) return;
    setProcessingId(id);
    setMsg("");
    try {
      const payload =
        action === "pay"
          ? { withdrawal_id: id, action: "pay", pi_txid: `manual-${Date.now()}`, admin_note: "Processed from Admin Dashboard Treasury" }
          : { withdrawal_id: id, action: "reject", admin_note: "Rejected from Admin Dashboard Treasury" };
      const r = await fetch("/api/admin/treasury", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!d?.success) {
        setMsg(`❌ ${d?.error ?? "Failed to process withdrawal"}`);
      } else {
        setMsg(action === "pay" ? "✅ Withdrawal marked as paid." : "✅ Withdrawal rejected.");
        const refreshed = await safeFetch(`/api/admin/treasury?period=${period}`, token);
        if (refreshed?.success) setTreasury(refreshed.data);
      }
    } catch {
      setMsg("❌ Failed to process withdrawal.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <span className={styles.icon}>🏠</span>
          <div>
          <h1 className={styles.title}>Main Dashboard</h1>
          </div>
        </div>
        <div className={styles.liveTag}>● LIVE</div>
      </div>
      <div className={styles.section}>
        <div className={styles.sectionRow}>
          <h2 className={styles.sectionTitle}>Treasury Wallet</h2>
          <div className={styles.periodWrap}>
            <button className={`${styles.periodBtn} ${period==="week" ? styles.periodBtnActive : ""}`} onClick={() => setPeriod("week")}>7d</button>
            <button className={`${styles.periodBtn} ${period==="month" ? styles.periodBtnActive : ""}`} onClick={() => setPeriod("month")}>Month</button>
            <button className={`${styles.periodBtn} ${period==="all" ? styles.periodBtnActive : ""}`} onClick={() => setPeriod("all")}>All</button>
          </div>
        </div>
        {loading && <div className={styles.loading}>Loading treasury data...</div>}
        {!loading && msg ? <div className={styles.apiWarn}>{msg}</div> : null}
        {treasury ? (
          <>
            <div className={styles.treasuryGrid}>
              <div className={styles.treasuryCard}>
                <div className={styles.treasuryLabel}>Available Balance</div>
                <div className={styles.treasuryValue}>{Number(treasury.summary.available_balance_pi).toFixed(4)} π</div>
                <div className={styles.treasurySub}>Estimated after pending payouts</div>
              </div>
              <div className={styles.treasuryCard}>
                <div className={styles.treasuryLabel}>Pending Payouts</div>
                <div className={styles.treasuryValueWarn}>{Number(treasury.summary.pending_payouts_pi).toFixed(4)} π</div>
                <div className={styles.treasurySub}>{treasury.pending_withdrawals.length} withdrawal request(s)</div>
              </div>
              <div className={styles.treasuryCard}>
                <div className={styles.treasuryLabel}>Total Commission</div>
                <div className={styles.treasuryValue}>{Number(treasury.summary.total_commission_pi).toFixed(4)} π</div>
                <div className={styles.treasurySub}>From completed escrow releases</div>
              </div>
            </div>
            <div className={styles.splitGrid}>
              <div className={styles.panel}>
                <div className={styles.panelTitle}>Pending Payout Queue</div>
                {treasury.pending_withdrawals?.length ? treasury.pending_withdrawals.map((w) => (
                  <div key={w.id} className={styles.row}>
                    <div className={styles.rowInfo}>
                      <div className={styles.rowTitle}>@{w.seller?.username ?? "seller"} · {Number(w.amount_pi).toFixed(4)} π</div>
                      <div className={styles.rowSub}>{fmtDate(w.requested_at)} · {w.wallet_address || "No wallet address"}</div>
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
                {treasury.recent_withdrawals?.length ? treasury.recent_withdrawals.map((w) => (
                  <div key={w.id} className={styles.row}>
                    <div className={styles.rowInfo}>
                      <div className={styles.rowTitle}>@{w.seller?.username ?? "seller"} · {Number(w.amount_pi).toFixed(4)} π</div>
                      <div className={styles.rowSub}>{fmtDate(w.processed_at)} · {w.pi_txid ?? "No txid"}</div>
                    </div>
                    <span className={`${styles.badge} ${w.status === "paid" ? styles.badgeOk : styles.badgeWarn}`}>{w.status}</span>
                  </div>
                )) : <div className={styles.empty}>No processed withdrawals yet</div>}
              </div>
            </div>
          </>
        ) : (
          <div className={styles.apiWarn}>Treasury data unavailable. Check `/api/admin/treasury` auth/table.</div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionRow}>
          <h2 className={styles.sectionTitle}>Supa Credits Wallet</h2>
          <Link href="/admin/sc-wallet" className={styles.seeAll}>Open SC Admin →</Link>
        </div>
        {!scWallet ? (
          <div className={styles.loading}>Loading SC wallet data...</div>
        ) : (
          <>
            <div className={styles.scGrid}>
              <div className={styles.treasuryCard}>
                <div className={styles.treasuryLabel}>Total SC Balance</div>
                <div className={styles.treasuryValue}>{Number(scWallet.summary.total_balance).toFixed(2)} SC</div>
                <div className={styles.treasurySub}>{scWallet.summary.active_wallets}/{scWallet.summary.total_wallets} active wallets</div>
              </div>
              <div className={styles.treasuryCard}>
                <div className={styles.treasuryLabel}>Total SC Earned</div>
                <div className={styles.treasuryValue}>{Number(scWallet.summary.total_earned).toFixed(2)} SC</div>
                <div className={styles.treasurySub}>All-time earned across platform</div>
              </div>
              <div className={styles.treasuryCard}>
                <div className={styles.treasuryLabel}>Total SC Spent</div>
                <div className={styles.treasuryValueWarn}>{Number(scWallet.summary.total_spent).toFixed(2)} SC</div>
                <div className={styles.treasurySub}>All-time spend/usage</div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionRow}>
          <h2 className={styles.sectionTitle}>Referral Stats</h2>
          <Link href="/admin/platforms/referral" className={styles.seeAll}>Open Referral Admin →</Link>
        </div>
        <div className={styles.referralGrid}>
          <div className={styles.treasuryCard}>
            <div className={styles.treasuryLabel}>Total Referrals</div>
            <div className={styles.treasuryValue}>{Number(referralStats?.total_referrals ?? 0).toFixed(0)}</div>
          </div>
          <div className={styles.treasuryCard}>
            <div className={styles.treasuryLabel}>Active Referrers</div>
            <div className={styles.treasuryValue}>{Number(referralStats?.active_referrers ?? 0).toFixed(0)}</div>
          </div>
          <div className={styles.treasuryCard}>
            <div className={styles.treasuryLabel}>Pending Payout</div>
            <div className={styles.treasuryValueWarn}>{Number(referralStats?.pending_pi ?? 0).toFixed(2)} π</div>
          </div>
          <div className={styles.treasuryCard}>
            <div className={styles.treasuryLabel}>Total Earned</div>
            <div className={styles.treasuryValue}>{Number(referralStats?.total_earnings_pi ?? 0).toFixed(2)} π</div>
          </div>
        </div>
      </div>

    </div>
  );
}