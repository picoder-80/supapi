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
interface SupaChatRevenueData {
  total_pi: number;
  by_type: Record<string, number>;
  by_day: Record<string, number>;
  top_rooms: Array<{ room_id: string; room_name: string; amount_pi: number }>;
  active_verified_badges: number;
  active_promotions: number;
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
  const [supaChatRevenue, setSupaChatRevenue] = useState<SupaChatRevenueData | null>(null);
  const [period, setPeriod] = useState<"all" | "month" | "week">("all");
  const [loading,    setLoading]    = useState(true);
  const [msg, setMsg] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const exportSupaChatRevenueCsv = async () => {
    const token = localStorage.getItem("supapi_admin_token") ?? "";
    if (!token) return;
    try {
      const r = await fetch(`/api/admin/supachat/revenue/export?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        setMsg("Failed to export SupaChat revenue CSV.");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `supachat-revenue-${period}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setMsg("Failed to export SupaChat revenue CSV.");
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("supapi_admin_token") ?? "";
    setLoading(true);
    setMsg("");
    Promise.all([
      safeFetch(`/api/admin/treasury?period=${period}`, token),
      safeFetch("/api/admin/sc-wallet?limit=8", token),
      safeFetch("/api/admin/referral?type=stats", token),
      safeFetch(`/api/admin/supachat/revenue?period=${period}`, token),
    ])
      .then(([t, sc, rs, sr]) => {
      if (t?.success) setTreasury(t.data);
      else setMsg("Failed to load treasury.");
      if (sc?.success) setScWallet(sc.data);
      if (rs?.success) setReferralStats(rs.data);
      if (sr?.success) setSupaChatRevenue(sr.data);
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

      {/* ── Hero Header ── */}
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroIcon}>π</div>
          <div>
            <h1 className={styles.heroTitle}>Admin Dashboard</h1>
            <p className={styles.heroSub}>Overview of treasury, referrals, and platform revenue</p>
          </div>
        </div>
        <div className={styles.heroBadge}>
          <span className={styles.heroBadgeDot} />
          Live
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionRow}>
          <h2 className={styles.sectionTitle}><span className={styles.sectionIcon}>🏦</span> Treasury Wallet</h2>
          <div className={styles.sectionActions}>
            <div className={styles.periodWrap}>
            <button className={`${styles.periodBtn} ${period==="week" ? styles.periodBtnActive : ""}`} onClick={() => setPeriod("week")}>7d</button>
            <button className={`${styles.periodBtn} ${period==="month" ? styles.periodBtnActive : ""}`} onClick={() => setPeriod("month")}>Month</button>
            <button className={`${styles.periodBtn} ${period==="all" ? styles.periodBtnActive : ""}`} onClick={() => setPeriod("all")}>All</button>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Link href="/admin/treasury" className={styles.sectionLink}>Treasury →</Link>
            </div>
          </div>
        </div>
        {loading && <div className={styles.loading}>Loading treasury data...</div>}
        {!loading && msg ? <div className={styles.apiWarn}>{msg}</div> : null}
        {treasury ? (
          <>
            <div className={styles.treasuryGrid}>
              <div className={styles.treasuryCard}>
                <div className={styles.treasuryLabel}>Total Revenue</div>
                <div className={styles.treasuryValue}>{Number(treasury.summary.total_gross_pi).toFixed(4)} π</div>
                <div className={styles.treasurySub}>gross from all platforms</div>
              </div>
              <div className={styles.treasuryCard}>
                <div className={styles.treasuryLabel}>Supapi Commission</div>
                <div className={styles.treasuryValue}>{Number(treasury.summary.total_commission_pi).toFixed(4)} π</div>
                <div className={styles.treasurySub}>your earnings</div>
              </div>
              <div className={styles.treasuryCard}>
                <div className={styles.treasuryLabel}>Pending Payouts</div>
                <div className={styles.treasuryValueWarn}>{Number(treasury.summary.pending_payouts_pi).toFixed(4)} π</div>
                <div className={styles.treasurySub}>owed to sellers · {treasury.pending_withdrawals.length} request(s)</div>
              </div>
              <div className={`${styles.treasuryCard} ${styles.treasuryCardPrimary}`}>
                <div className={styles.treasuryLabel}>Available Balance</div>
                <div className={styles.treasuryValue}>{Number(treasury.summary.available_after_owner_pi ?? treasury.summary.available_balance_pi).toFixed(4)} π</div>
                <div className={styles.treasurySub}>commission − payouts − withdrawn</div>
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
          <h2 className={styles.sectionTitle}><span className={styles.sectionIcon}>💎</span> Supa Credits Wallet</h2>
          <Link href="/admin/sc-wallet" className={styles.sectionLink}>Open SC Admin →</Link>
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
          <h2 className={styles.sectionTitle}><span className={styles.sectionIcon}>🤝</span> Referral Stats</h2>
          <Link href="/admin/platforms/referral" className={styles.sectionLink}>Open Referral Admin →</Link>
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

      <div className={styles.section}>
        <div className={styles.sectionRow}>
          <h2 className={styles.sectionTitle}><span className={styles.sectionIcon}>💬</span> SupaChat Revenue</h2>
          <div className={styles.sectionActions}>
            <button type="button" className={styles.exportCsvBtn} onClick={exportSupaChatRevenueCsv}>
              Export CSV
            </button>
            <Link href="/admin/platforms/supachat" className={styles.sectionLink}>SupaChat Admin →</Link>
            <Link href="/supachat" className={styles.sectionLink}>Open SupaChat →</Link>
          </div>
        </div>
        {!supaChatRevenue ? (
          <div className={styles.loading}>Loading SupaChat revenue...</div>
        ) : (
          <div className={styles.supaChatRevenueContent}>
            <div className={styles.referralGrid}>
              <div className={styles.treasuryCard}>
                <div className={styles.treasuryLabel}>Total Revenue</div>
                <div className={styles.treasuryValue}>{Number(supaChatRevenue.total_pi ?? 0).toFixed(4)} π</div>
              </div>
              <div className={styles.treasuryCard}>
                <div className={styles.treasuryLabel}>Active Verified Badges</div>
                <div className={styles.treasuryValue}>{Number(supaChatRevenue.active_verified_badges ?? 0).toFixed(0)}</div>
              </div>
              <div className={styles.treasuryCard}>
                <div className={styles.treasuryLabel}>Active Promotions</div>
                <div className={styles.treasuryValue}>{Number(supaChatRevenue.active_promotions ?? 0).toFixed(0)}</div>
              </div>
              <div className={styles.treasuryCard}>
                <div className={styles.treasuryLabel}>Transfer Commission</div>
                <div className={styles.treasuryValue}>{Number(supaChatRevenue.by_type?.transfer_commission ?? 0).toFixed(4)} π</div>
              </div>
            </div>
            <div className={styles.splitGrid}>
              <div className={styles.panel}>
                <div className={styles.panelTitle}>Revenue Breakdown</div>
                {Object.entries(supaChatRevenue.by_type ?? {}).length ? (
                  Object.entries(supaChatRevenue.by_type)
                    .sort((a, b) => Number(b[1]) - Number(a[1]))
                    .map(([k, v]) => (
                      <div key={k} className={styles.row}>
                        <div className={styles.rowInfo}>
                          <div className={styles.rowTitle}>{k}</div>
                        </div>
                        <span className={styles.badge}>{Number(v).toFixed(4)} π</span>
                      </div>
                    ))
                ) : <div className={styles.empty}>No SupaChat revenue yet</div>}
              </div>
              <div className={styles.panel}>
                <div className={styles.panelTitle}>Top Revenue Rooms</div>
                {supaChatRevenue.top_rooms?.length ? (
                  supaChatRevenue.top_rooms.map((r) => (
                    <div key={r.room_id} className={styles.row}>
                      <div className={styles.rowInfo}>
                        <div className={styles.rowTitle}>{r.room_name}</div>
                      </div>
                      <span className={styles.badge}>{Number(r.amount_pi).toFixed(4)} π</span>
                    </div>
                  ))
                ) : <div className={styles.empty}>No room revenue yet</div>}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}