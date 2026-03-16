"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

// ── Types ──────────────────────────────────────────────────────────────────
interface ScWallet {
  balance: number; total_earned: number; total_spent: number;
  checkin_streak: number; last_checkin: string | null;
}
interface EarningsWallet {
  pending_pi: number; available_pi: number;
  total_earned: number; total_withdrawn: number;
}
interface ScTxn {
  id: string; type: string; activity: string;
  amount: number; balance_after: number; note: string; created_at: string;
}
interface EarnTxn {
  id: string; type: string; source: string;
  amount_pi: number; status: string; note: string; created_at: string;
}
interface Referral {
  id: string; referee_id: string; status: string;
  bonus_paid_pi: number; created_at: string;
  referee?: { username: string; avatar_url: string | null; kyc_status: string };
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatPi(n: number)  {
  if (!n) return "0.000";
  return n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function formatSc(n: number)  { return (n ?? 0).toLocaleString(); }
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)   return "just now";
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function getInitial(s: string) { return (s ?? "?").charAt(0).toUpperCase(); }

const EARN_TYPE_META: Record<string, { icon: string; color: string }> = {
  referral:         { icon: "👥", color: "#48BB78" },
  endoro_host:      { icon: "🚗", color: "#4299E1" },
  bulkhub_supplier: { icon: "📦", color: "#ED8936" },
  domus_rental:     { icon: "🏠", color: "#9F7AEA" },
  gig_payout:       { icon: "💼", color: "#F6AD55" },
  gift_split:       { icon: "🎁", color: "#FC8181" },
  tip:              { icon: "💌", color: "#F687B3" },
  machina_deal:     { icon: "🔧", color: "#68D391" },
  withdrawal:       { icon: "↗️", color: "#FC8181" },
  default:          { icon: "💰", color: "#F5A623" },
};

const SC_TYPE_META: Record<string, { icon: string; color: string }> = {
  earn:     { icon: "⬆️", color: "#48BB78" },
  spend:    { icon: "⬇️", color: "#FC8181" },
  buy:      { icon: "🛒", color: "#4299E1" },
  gift:     { icon: "🎁", color: "#F687B3" },
  transfer: { icon: "↔️", color: "#F6AD55" },
  default:  { icon: "💎", color: "#F5A623" },
};

const REFERRAL_STATUS_META: Record<string, { label: string; color: string }> = {
  signed_up:     { label: "Signed Up",     color: "#718096" },
  kyc_done:      { label: "KYC Done",      color: "#4299E1" },
  first_payment: { label: "First Payment", color: "#48BB78" },
  active:        { label: "Active",        color: "#F5A623" },
};

// ── Withdraw Modal ─────────────────────────────────────────────────────────
function WithdrawModal({
  available, onClose, onConfirm, loading
}: { available: number; onClose: () => void; onConfirm: (amt: number) => void; loading: boolean }) {
  const [amount, setAmount] = useState("");
  const max = available;
  const val = parseFloat(amount) || 0;
  const valid = val >= 1 && val <= max;

  return (
    <div className={styles.modal}>
      <div className={styles.modalBackdrop} onClick={() => !loading && onClose()} />
      <div className={styles.modalSheet}>
        <div className={styles.modalHandle} />
        <div className={styles.modalTitle}>↗️ Withdraw to Pi Wallet</div>
        <div className={styles.modalSub}>Minimum withdrawal: π 1.000 · Available: π {formatPi(available)}</div>

        <div className={styles.withdrawInputWrap}>
          <span className={styles.withdrawCurrency}>π</span>
          <input
            className={styles.withdrawInput}
            type="number"
            placeholder="0.000"
            value={amount}
            min="1"
            max={max}
            step="0.001"
            onChange={e => setAmount(e.target.value)}
          />
          <button className={styles.withdrawMaxBtn} onClick={() => setAmount(max.toString())}>MAX</button>
        </div>

        {val > 0 && !valid && (
          <div className={styles.withdrawError}>
            {val < 1 ? "Minimum withdrawal is π 1.000" : "Insufficient balance"}
          </div>
        )}

        <div className={styles.withdrawSummary}>
          <div className={styles.withdrawSummaryRow}>
            <span>Amount</span><span>π {formatPi(val)}</span>
          </div>
          <div className={styles.withdrawSummaryRow}>
            <span>Fee</span><span className={styles.withdrawFree}>Free</span>
          </div>
          <div className={`${styles.withdrawSummaryRow} ${styles.withdrawSummaryTotal}`}>
            <span>You receive</span><span>π {formatPi(val)}</span>
          </div>
        </div>

        <button
          className={styles.withdrawConfirmBtn}
          disabled={!valid || loading}
          onClick={() => onConfirm(val)}
        >
          {loading ? "Processing..." : `Withdraw π ${formatPi(val)}`}
        </button>
        <button className={styles.modalCancelBtn} onClick={onClose} disabled={loading}>Cancel</button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function WalletPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [activeTab, setActiveTab]       = useState<"pi" | "sc" | "earnings">("pi");
  const [data, setData]                 = useState<any>(null);
  const [loading, setLoading]           = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [piBalance, setPiBalance]       = useState<number | null>(null);
  const [piLoading, setPiLoading]       = useState(false);
  const [toast, setToast]               = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [scPage, setScPage]             = useState(1);
  const [earnPage, setEarnPage]         = useState(1);

  const token = () => typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "";

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Try to get Pi balance from SDK
  useEffect(() => {
    const tryGetPiBalance = async () => {
      try {
        const w = (window as any);
        if (w.Pi) {
          setPiLoading(true);
          // Pi SDK doesn't expose wallet balance directly; show placeholder
          setPiBalance(null);
          setPiLoading(false);
        }
      } catch {}
    };
    tryGetPiBalance();
  }, []);

  const fetchData = useCallback(async (tab: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/wallet?tab=${tab}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const d = await r.json();
      if (d.success) setData(d.data);
    } catch {}
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) { router.push("/dashboard"); return; }
    fetchData(activeTab);
  }, [user, activeTab, fetchData]);

  const handleWithdraw = async (amount: number) => {
    setWithdrawLoading(true);
    try {
      const r = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ action: "withdraw", amount_pi: amount }),
      });
      const d = await r.json();
      if (d.success) {
        setShowWithdraw(false);
        showToast(`✅ π ${formatPi(amount)} withdrawn to your Pi Wallet!`);
        fetchData("earnings");
      } else {
        showToast(d.error ?? "Withdrawal failed", "error");
      }
    } catch { showToast("Something went wrong", "error"); }
    setWithdrawLoading(false);
  };

  const scWallet:       ScWallet       = data?.scWallet       ?? { balance: 0, total_earned: 0, total_spent: 0, checkin_streak: 0, last_checkin: null };
  const earningsWallet: EarningsWallet = data?.earningsWallet ?? { pending_pi: 0, available_pi: 0, total_earned: 0, total_withdrawn: 0 };
  const scTxns:         ScTxn[]        = data?.scTransactions ?? [];
  const earnTxns:       EarnTxn[]      = data?.earningsTransactions ?? [];
  const referrals:      Referral[]     = data?.referrals ?? [];

  const SC_PAGE_SIZE = 10;
  const EARN_PAGE_SIZE = 10;
  const scTotalPages = Math.max(1, Math.ceil(scTxns.length / SC_PAGE_SIZE));
  const earnTotalPages = Math.max(1, Math.ceil(earnTxns.length / EARN_PAGE_SIZE));
  const scPageSafe = Math.min(scPage, scTotalPages);
  const earnPageSafe = Math.min(earnPage, earnTotalPages);
  const scPageItems = scTxns.slice((scPageSafe - 1) * SC_PAGE_SIZE, scPageSafe * SC_PAGE_SIZE);
  const earnPageItems = earnTxns.slice((earnPageSafe - 1) * EARN_PAGE_SIZE, earnPageSafe * EARN_PAGE_SIZE);

  if (!user) return null;

  return (
    <div className={styles.page}>
      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerBg} />
        <div className={styles.headerContent}>
          <div className={styles.headerTitle}>My Wallet</div>
          <div className={styles.headerSub}>All your Supapi balances in one place</div>

          {/* Wallet Summary Cards */}
          <div className={styles.walletCards}>
            {/* Pi Wallet Card */}
            <button
              className={`${styles.walletCard} ${activeTab === "pi" ? styles.walletCardActive : ""}`}
              onClick={() => setActiveTab("pi")}
            >
              <div className={styles.walletCardIcon}>🥧</div>
              <div className={styles.walletCardLabel}>Pi Wallet</div>
              <div className={styles.walletCardValue}>
                {piLoading ? "—" : piBalance !== null ? `π ${formatPi(piBalance)}` : "Pi Browser"}
              </div>
              <div className={styles.walletCardSub}>Native Pi</div>
            </button>

            {/* SC Wallet Card */}
            <button
              className={`${styles.walletCard} ${styles.walletCardSc} ${activeTab === "sc" ? styles.walletCardActive : ""}`}
              onClick={() => setActiveTab("sc")}
            >
              <div className={styles.walletCardIcon}>💎</div>
              <div className={styles.walletCardLabel}>SC Wallet</div>
              <div className={styles.walletCardValue}>{formatSc(scWallet.balance)} SC</div>
              <div className={styles.walletCardSub}>SupaCredits</div>
            </button>

            {/* Earnings Wallet Card */}
            <button
              className={`${styles.walletCard} ${styles.walletCardEarnings} ${activeTab === "earnings" ? styles.walletCardActive : ""}`}
              onClick={() => setActiveTab("earnings")}
            >
              <div className={styles.walletCardIcon}>🏦</div>
              <div className={styles.walletCardLabel}>Earnings</div>
              <div className={styles.walletCardValue}>π {formatPi(earningsWallet.available_pi)}</div>
              <div className={styles.walletCardSub}>
                {earningsWallet.pending_pi > 0 ? `+ π ${formatPi(earningsWallet.pending_pi)} pending` : "Available"}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>

        {/* ════════════════════════════════════════
            PI WALLET TAB
        ════════════════════════════════════════ */}
        {activeTab === "pi" && (
          <div className={styles.tabContent}>
            {/* Pi balance card */}
            <div className={styles.piCard}>
              <div className={styles.piCardGlow} />
              <div className={styles.piCardTop}>
                <div className={styles.piCardIconWrap}>🥧</div>
                <div className={styles.piCardInfo}>
                  <div className={styles.piCardTitle}>Pi Network Wallet</div>
                  <div className={styles.piCardSub}>Connected via Pi Browser</div>
                </div>
              </div>
              <div className={styles.piCardBalance}>
                <span className={styles.piCardBalanceLabel}>Balance</span>
                <span className={styles.piCardBalanceValue}>
                  {piBalance !== null ? `π ${formatPi(piBalance)}` : "Open in Your Pi Browser to view"}
                </span>
              </div>
              <div className={styles.piCardNote}>
                💡 Pi balance is managed by the Pi Network app. Supapi uses your Pi wallet for payments across all platforms.
              </div>
            </div>

            {/* Quick actions */}
            <div className={styles.sectionTitle}>Quick Actions</div>
            <div className={styles.quickActions}>
              {[
                { href: "/supamarket",          icon: "🛍️", label: "SupaMarket"    },
                { href: "/supaendoro",          icon: "🛞", label: "Rent a Car"    },
                { href: "/supadomus",           icon: "🏠", label: "Property"      },
{ href: "/supabulk",         icon: "📦", label: "SupaBulk"      },
  { href: "/supaauto",  icon: "🚗", label: "SupaAuto"     },
                { href: "/rewards",         icon: "💎", label: "SC Rewards"    },
              ].map(a => (
                <Link key={a.href} href={a.href} className={styles.quickAction}>
                  <span className={styles.quickActionIcon}>{a.icon}</span>
                  <span className={styles.quickActionLabel}>{a.label}</span>
                </Link>
              ))}
            </div>

            {/* Recent Pi activity */}
            {(data?.recentPiActivity ?? []).length > 0 && (
              <>
                <div className={styles.sectionTitle}>Recent Pi Activity</div>
                <div className={styles.txnList}>
                  {(data.recentPiActivity ?? []).map((txn: EarnTxn) => {
                    const meta = EARN_TYPE_META[txn.type] ?? EARN_TYPE_META.default;
                    const isWithdrawal = txn.type === "withdrawal";
                    return (
                      <div key={txn.id} className={styles.txnRow}>
                        <div className={styles.txnIcon} style={{ background: meta.color + "18" }}>
                          <span>{meta.icon}</span>
                        </div>
                        <div className={styles.txnInfo}>
                          <div className={styles.txnSource}>{txn.source}</div>
                          <div className={styles.txnTime}>{timeAgo(txn.created_at)}</div>
                        </div>
                        <div className={`${styles.txnAmount} ${isWithdrawal ? styles.txnAmountNeg : styles.txnAmountPos}`}>
                          {isWithdrawal ? "-" : "+"}π {formatPi(Math.abs(txn.amount_pi))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════
            SC WALLET TAB
        ════════════════════════════════════════ */}
        {activeTab === "sc" && (
          <div className={styles.tabContent}>
            {/* SC Balance card */}
            <div className={styles.scCard}>
              <div className={styles.scCardGlow} />
              <div className={styles.scCardTop}>
                <div className={styles.scCardIconWrap}>💎</div>
                <div>
                  <div className={styles.scCardTitle}>SupaCredits</div>
                  <div className={styles.scCardSub}>1 SC = $0.01 USD</div>
                </div>
              </div>
              <div className={styles.scCardBalance}>{formatSc(scWallet.balance)}</div>
              <div className={styles.scCardBalanceLabel}>SC Available</div>

              <div className={styles.scCardStats}>
                <div className={styles.scCardStat}>
                  <span className={styles.scCardStatVal}>{formatSc(scWallet.total_earned)}</span>
                  <span className={styles.scCardStatLabel}>Total Earned</span>
                </div>
                <div className={styles.scCardStatDiv} />
                <div className={styles.scCardStat}>
                  <span className={styles.scCardStatVal}>{formatSc(scWallet.total_spent)}</span>
                  <span className={styles.scCardStatLabel}>Total Spent</span>
                </div>
                <div className={styles.scCardStatDiv} />
                <div className={styles.scCardStat}>
                  <span className={styles.scCardStatVal}>🔥 {scWallet.checkin_streak}</span>
                  <span className={styles.scCardStatLabel}>Day Streak</span>
                </div>
              </div>
            </div>

            {/* SC Actions */}
            <div className={styles.scActions}>
              <Link href="/rewards" className={styles.scActionBtn}>
                <span>🎯</span> Earn SC
              </Link>
              <Link href="/rewards#buy" className={styles.scActionBtn}>
                <span>🛒</span> Buy SC
              </Link>
              <Link href="/rewards#gift" className={styles.scActionBtn}>
                <span>🎁</span> Gift SC
              </Link>
              <Link href="/rewards#transfer" className={styles.scActionBtn}>
                <span>↔️</span> Transfer
              </Link>
            </div>

            {/* SC Earn ways */}
            <div className={styles.sectionTitle}>Ways to Earn SC</div>
            <div className={styles.earnWays}>
              {[
                { icon: "📅", label: "Daily Check-in",        sc: "+10 SC"  },
                { icon: "🔥", label: "7-Day Streak Bonus",    sc: "+50 SC"  },
{ icon: "🏠", label: "List on SupaDomus",   sc: "+150 SC" },
    { icon: "🚗", label: "List on SupaAuto",  sc: "+150 SC" },
    { icon: "📦", label: "SupaBulk Supplier", sc: "+100 SC" },
    { icon: "🛞", label: "List on SupaEndoro", sc: "+150 SC" },
                { icon: "📝", label: "Post on SupaLivvi",     sc: "+20 SC"  },
                { icon: "🧵", label: "Post on SupaSaylo",     sc: "+15 SC"  },
              ].map((w, i) => (
                <div key={i} className={styles.earnWayRow}>
                  <span className={styles.earnWayIcon}>{w.icon}</span>
                  <span className={styles.earnWayLabel}>{w.label}</span>
                  <span className={styles.earnWaySc}>{w.sc}</span>
                </div>
              ))}
            </div>

            {/* SC Transactions */}
            <div className={styles.sectionTitle}>Transaction History</div>
            {loading ? (
              <div className={styles.skeletonList}>
                {[...Array(5)].map((_, i) => <div key={i} className={styles.skeletonRow} />)}
              </div>
            ) : scTxns.length === 0 ? (
              <div className={styles.emptyTxn}>No transactions yet</div>
            ) : (
              <div className={styles.txnList}>
                {scPageItems.map((txn: ScTxn) => {
                  const meta = SC_TYPE_META[txn.type] ?? SC_TYPE_META.default;
                  const isSpend = txn.type === "spend";
                  return (
                    <div key={txn.id} className={styles.txnRow}>
                      <div className={styles.txnIcon} style={{ background: meta.color + "18" }}>
                        <span>{meta.icon}</span>
                      </div>
                      <div className={styles.txnInfo}>
                        <div className={styles.txnSource}>{txn.note || txn.activity}</div>
                        <div className={styles.txnTime}>{timeAgo(txn.created_at)}</div>
                      </div>
                      <div className={styles.txnRight}>
                        <div className={`${styles.txnAmount} ${isSpend ? styles.txnAmountNeg : styles.txnAmountPos}`}>
                          {isSpend ? "-" : "+"}{Math.abs(txn.amount)} SC
                        </div>
                        <div className={styles.txnBalance}>{txn.balance_after} SC</div>
                      </div>
                    </div>
                  );
                })}
                {scTotalPages > 1 && (
                  <div className={styles.pager}>
                    <button
                      type="button"
                      className={styles.pagerBtn}
                      disabled={scPageSafe === 1}
                      onClick={() => setScPage((p) => Math.max(1, p - 1))}
                    >
                      ← Prev
                    </button>
                    <span className={styles.pagerInfo}>
                      Page {scPageSafe} of {scTotalPages}
                    </span>
                    <button
                      type="button"
                      className={styles.pagerBtn}
                      disabled={scPageSafe === scTotalPages}
                      onClick={() => setScPage((p) => Math.min(scTotalPages, p + 1))}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════
            EARNINGS TAB
        ════════════════════════════════════════ */}
        {activeTab === "earnings" && (
          <div className={styles.tabContent}>
            {/* Earnings card */}
            <div className={styles.earningsCard}>
              <div className={styles.earningsCardGlow} />
              <div className={styles.earningsCardTop}>
                <div>
                  <div className={styles.earningsCardTitle}>🏦 Earnings Wallet</div>
                  <div className={styles.earningsCardSub}>Pi earned across all Supapi platforms</div>
                </div>
                {earningsWallet.available_pi >= 1 && (
                  <button className={styles.withdrawBtn} onClick={() => setShowWithdraw(true)}>
                    Withdraw →
                  </button>
                )}
              </div>

              <div className={styles.earningsBalanceRow}>
                <div className={styles.earningsBalance}>
                  <div className={styles.earningsBalanceLabel}>Available</div>
                  <div className={styles.earningsBalanceValue}>π {formatPi(earningsWallet.available_pi)}</div>
                </div>
                {earningsWallet.pending_pi > 0 && (
                  <div className={styles.earningsPending}>
                    <div className={styles.earningsBalanceLabel}>Pending</div>
                    <div className={styles.earningsPendingValue}>π {formatPi(earningsWallet.pending_pi)}</div>
                  </div>
                )}
              </div>

              <div className={styles.earningsStats}>
                <div className={styles.earningsStat}>
                  <span className={styles.earningsStatVal}>π {formatPi(earningsWallet.total_earned)}</span>
                  <span className={styles.earningsStatLabel}>Lifetime Earned</span>
                </div>
                <div className={styles.earningsStatDiv} />
                <div className={styles.earningsStat}>
                  <span className={styles.earningsStatVal}>π {formatPi(earningsWallet.total_withdrawn)}</span>
                  <span className={styles.earningsStatLabel}>Total Withdrawn</span>
                </div>
              </div>

              {earningsWallet.available_pi < 1 && (
                <div className={styles.earningsMinNote}>
                  💡 Minimum withdrawal is π 1.000. Keep earning!
                </div>
              )}
            </div>

            {/* Earning sources breakdown */}
            <div className={styles.sectionTitle}>Earning Sources</div>
            <div className={styles.sourcesList}>
              {[
                { type: "referral",         icon: "👥", label: "Referral Bonuses",        desc: "Earn Pi when your referrals join & use Supapi" },
                { type: "endoro_host",      icon: "🛞", label: "SupaEndoro Host Payouts", desc: "Earn rental fees from your vehicles" },
                { type: "gig_payout",       icon: "💼", label: "Gig Job Completions",      desc: "Pi released from escrow when job is done" },
{ type: "domus_rental",     icon: "🏠", label: "SupaDomus Property Rentals", desc: "Pi rental payments from tenants" },
    { type: "bulkhub_supplier", icon: "📦", label: "SupaBulk Order Payouts",   desc: "Pi from wholesale orders completed" },
    { type: "machina_deal",     icon: "🚗", label: "SupaAuto Deals",          desc: "Pi from vehicle sale completions" },
                { type: "gift_split",       icon: "🎁", label: "Gift Splits (70%)",        desc: "Your share of SC gifts received as Pi" },
                { type: "tip",              icon: "💌", label: "Creator Tips",             desc: "Tips from SupaLivvi & SupaSaylo content" },
              ].map(src => (
                <div key={src.type} className={styles.sourceRow}>
                  <div className={styles.sourceIcon}
                    style={{ background: (EARN_TYPE_META[src.type]?.color ?? "#F5A623") + "18" }}>
                    {src.icon}
                  </div>
                  <div className={styles.sourceInfo}>
                    <div className={styles.sourceLabel}>{src.label}</div>
                    <div className={styles.sourceDesc}>{src.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Referrals */}
            {referrals.length > 0 && (
              <>
                <div className={styles.sectionTitle}>Your Referrals</div>
                <div className={styles.referralList}>
                  {referrals.map((ref: Referral) => {
                    const statusMeta = REFERRAL_STATUS_META[ref.status] ?? REFERRAL_STATUS_META.signed_up;
                    return (
                      <div key={ref.id} className={styles.referralRow}>
                        <div className={styles.referralAvatar}>
                          {ref.referee?.avatar_url
                            ? <img src={ref.referee.avatar_url} alt="" className={styles.referralAvatarImg} />
                            : <span>{getInitial(ref.referee?.username ?? "?")}</span>
                          }
                        </div>
                        <div className={styles.referralInfo}>
                          <div className={styles.referralName}>
                            @{ref.referee?.username ?? "Pioneer"}
                            {ref.referee?.kyc_status === "verified" && " ✅"}
                          </div>
                          <div className={styles.referralTime}>{timeAgo(ref.created_at)}</div>
                        </div>
                        <div className={styles.referralRight}>
                          <div className={styles.referralStatus} style={{ color: statusMeta.color }}>
                            {statusMeta.label}
                          </div>
                          {ref.bonus_paid_pi > 0 && (
                            <div className={styles.referralBonus}>+π {formatPi(ref.bonus_paid_pi)}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Earnings transactions */}
            <div className={styles.sectionTitle}>Earnings History</div>
            {loading ? (
              <div className={styles.skeletonList}>
                {[...Array(5)].map((_, i) => <div key={i} className={styles.skeletonRow} />)}
              </div>
            ) : earnTxns.length === 0 ? (
              <div className={styles.emptyEarnings}>
                <div className={styles.emptyEarningsIcon}>🏦</div>
                <div className={styles.emptyEarningsTitle}>No earnings yet</div>
                <div className={styles.emptyEarningsDesc}>
                  Start earning Pi by hosting on SupaEndoro, listing on SupaBulk, completing gigs, or referring friends!
                </div>
                <div className={styles.emptyEarningsCtas}>
                  <Link href="/supaendoro/host"   className={styles.emptyEarningsBtn}>🚗 Host on SupaEndoro</Link>
                  <Link href="/referral"      className={styles.emptyEarningsBtn}>👥 Refer Friends</Link>
                  <Link href="/gigs"          className={styles.emptyEarningsBtn}>💼 Find SupaSkil</Link>
                </div>
              </div>
            ) : (
              <div className={styles.txnList}>
                {earnPageItems.map((txn: EarnTxn) => {
                  const meta = EARN_TYPE_META[txn.type] ?? EARN_TYPE_META.default;
                  const isWithdrawal = txn.type === "withdrawal";
                  return (
                    <div key={txn.id} className={styles.txnRow}>
                      <div className={styles.txnIcon} style={{ background: meta.color + "18" }}>
                        <span>{meta.icon}</span>
                      </div>
                      <div className={styles.txnInfo}>
                        <div className={styles.txnSource}>{txn.source}</div>
                        <div className={styles.txnMeta}>
                          <span className={styles.txnTime}>{timeAgo(txn.created_at)}</span>
                          <span className={`${styles.txnStatus} ${styles["txnStatus_" + txn.status]}`}>
                            {txn.status}
                          </span>
                        </div>
                      </div>
                      <div className={`${styles.txnAmount} ${isWithdrawal ? styles.txnAmountNeg : styles.txnAmountPos}`}>
                        {isWithdrawal ? "-" : "+"}π {formatPi(Math.abs(txn.amount_pi))}
                      </div>
                    </div>
                  );
                })}
                {earnTotalPages > 1 && (
                  <div className={styles.pager}>
                    <button
                      type="button"
                      className={styles.pagerBtn}
                      disabled={earnPageSafe === 1}
                      onClick={() => setEarnPage((p) => Math.max(1, p - 1))}
                    >
                      ← Prev
                    </button>
                    <span className={styles.pagerInfo}>
                      Page {earnPageSafe} of {earnTotalPages}
                    </span>
                    <button
                      type="button"
                      className={styles.pagerBtn}
                      disabled={earnPageSafe === earnTotalPages}
                      onClick={() => setEarnPage((p) => Math.min(earnTotalPages, p + 1))}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Withdraw Modal ── */}
      {showWithdraw && (
        <WithdrawModal
          available={earningsWallet.available_pi}
          onClose={() => setShowWithdraw(false)}
          onConfirm={handleWithdraw}
          loading={withdrawLoading}
        />
      )}
    </div>
  );
}
