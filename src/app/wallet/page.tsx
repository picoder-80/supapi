"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePi } from "@/components/providers/PiProvider";
import { getApiBase } from "@/lib/pi/sdk";
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
interface UserSuggestion {
  id: string;
  username: string;
  display_name: string | null;
}

const SC_PACKAGES = [
  { id: "starter", sc: 100, usd: 1.0, label: "Starter" },
  { id: "popular", sc: 500, usd: 5.0, label: "Popular" },
  { id: "pro", sc: 1000, usd: 10.0, label: "Pro" },
  { id: "whale", sc: 5000, usd: 50.0, label: "Whale" },
] as const;
const GIFT_ITEMS = [
  { id: "rose", emoji: "🌹", name: "Rose", sc: 10 },
  { id: "heart", emoji: "💖", name: "Heart", sc: 20 },
  { id: "star", emoji: "⭐", name: "Star", sc: 50 },
  { id: "crown", emoji: "👑", name: "Crown", sc: 100 },
] as const;
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

const EARN_TYPE_META: Record<string, { icon: string; color: string }> = {
  referral:         { icon: "👥", color: "#48BB78" },
  market_order:     { icon: "🛍️", color: "#4299E1" },
  supascrow_release:{ icon: "🛡️", color: "#14B8A6" },
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
  gift_sent: { icon: "🎁", color: "#FC8181" },
  gift_received: { icon: "🎁", color: "#48BB78" },
  transfer: { icon: "↔️", color: "#F6AD55" },
  transfer_out: { icon: "↗️", color: "#FC8181" },
  transfer_in: { icon: "↙️", color: "#48BB78" },
  default:  { icon: "💎", color: "#F5A623" },
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

function BuyScModal({
  piRate, buying, selected, onClose, onSelect, onConfirm,
}: {
  piRate: number;
  buying: boolean;
  selected: (typeof SC_PACKAGES)[number] | null;
  onClose: () => void;
  onSelect: (pkg: (typeof SC_PACKAGES)[number]) => void;
  onConfirm: () => void;
}) {
  return (
    <div className={styles.modal}>
      <div className={styles.modalBackdrop} onClick={() => !buying && onClose()} />
      <div className={styles.modalSheet}>
        <div className={styles.modalHandle} />
        <div className={styles.modalTitle}>🛒 Buy SC</div>
        <div className={styles.modalSub}>Choose package and pay with Pi</div>

        <div className={styles.buyPkgList}>
          {SC_PACKAGES.map((pkg) => {
            const piAmount = (pkg.usd / piRate).toFixed(4);
            const active = selected?.id === pkg.id;
            return (
              <button
                key={pkg.id}
                type="button"
                className={`${styles.buyPkgBtn} ${active ? styles.buyPkgBtnActive : ""}`}
                onClick={() => onSelect(pkg)}
              >
                <span className={styles.buyPkgLabel}>{pkg.label}</span>
                <span className={styles.buyPkgSc}>{pkg.sc} SC</span>
                <span className={styles.buyPkgPi}>~ π {piAmount}</span>
              </button>
            );
          })}
        </div>

        <button className={styles.withdrawConfirmBtn} onClick={onConfirm} disabled={!selected || buying}>
          {buying ? "Processing..." : selected ? `Buy ${selected.sc} SC` : "Select package"}
        </button>
        <button className={styles.modalCancelBtn} onClick={onClose} disabled={buying}>Cancel</button>
      </div>
    </div>
  );
}

function SendScModal({
  loading,
  username,
  amount,
  balance,
  suggestions,
  onClose,
  onChangeUsername,
  onChangeAmount,
  onPickSuggestion,
  onConfirm,
}: {
  loading: boolean;
  username: string;
  amount: string;
  balance: number;
  suggestions: UserSuggestion[];
  onClose: () => void;
  onChangeUsername: (v: string) => void;
  onChangeAmount: (v: string) => void;
  onPickSuggestion: (username: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div className={styles.modal}>
      <div className={styles.modalBackdrop} onClick={() => !loading && onClose()} />
      <div className={styles.modalSheet}>
        <div className={styles.modalHandle} />
        <div className={styles.modalTitle}>↔️ Send SupaCredit</div>
        <div className={styles.modalSub}>Instant transfer with zero fee</div>

        <div className={styles.sendScField}>
          <label className={styles.sendScLabel}>Recipient Username</label>
          <input
            className={styles.input}
            placeholder="example: satoshi"
            value={username}
            onChange={(e) => onChangeUsername(e.target.value)}
            autoComplete="off"
          />
          {suggestions.length > 0 && (
            <div className={styles.sendScSuggestList}>
              {suggestions.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={styles.sendScSuggestItem}
                  onClick={() => onPickSuggestion(u.username)}
                >
                  @{u.username}{u.display_name ? ` · ${u.display_name}` : ""}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={styles.sendScField}>
          <label className={styles.sendScLabel}>Amount (SC)</label>
          <input
            className={styles.input}
            type="number"
            min={1}
            step={1}
            placeholder="0"
            value={amount}
            onChange={(e) => onChangeAmount(e.target.value)}
          />
        </div>
        <div className={styles.withdrawSummary}>
          <div className={styles.withdrawSummaryRow}>
            <span>Your Balance</span><span>💎 {balance.toLocaleString()} SC</span>
          </div>
          <div className={styles.withdrawSummaryRow}>
            <span>Fee</span><span className={styles.withdrawFree}>0 SC</span>
          </div>
          <div className={`${styles.withdrawSummaryRow} ${styles.withdrawSummaryTotal}`}>
            <span>Receiver Gets</span><span>{amount && Number(amount) > 0 ? Number(amount) : 0} SC</span>
          </div>
        </div>
        <button className={styles.withdrawConfirmBtn} onClick={onConfirm} disabled={loading || !username.trim() || !amount.trim()}>
          {loading ? "Sending..." : "Send Transfer"}
        </button>
        <button className={styles.modalCancelBtn} onClick={onClose} disabled={loading}>Cancel</button>
      </div>
    </div>
  );
}

function GiftScModal({
  loading, username, selectedGift, suggestions, onClose, onChangeUsername, onPickSuggestion, onPickGift, onConfirm,
}: {
  loading: boolean;
  username: string;
  selectedGift: (typeof GIFT_ITEMS)[number] | null;
  suggestions: UserSuggestion[];
  onClose: () => void;
  onChangeUsername: (v: string) => void;
  onPickSuggestion: (username: string) => void;
  onPickGift: (gift: (typeof GIFT_ITEMS)[number]) => void;
  onConfirm: () => void;
}) {
  return (
    <div className={styles.modal}>
      <div className={styles.modalBackdrop} onClick={() => !loading && onClose()} />
      <div className={styles.modalSheet}>
        <div className={styles.modalHandle} />
        <div className={styles.modalTitle}>🎁 Gift SupaCredit</div>
        <div className={styles.modalSub}>Send gift to another Pioneer (receiver gets 70%)</div>

        <div className={styles.sendScField}>
          <label className={styles.sendScLabel}>Recipient Username</label>
          <input className={styles.input} placeholder="example: satoshi" value={username} onChange={(e) => onChangeUsername(e.target.value)} autoComplete="off" />
          {suggestions.length > 0 && (
            <div className={styles.sendScSuggestList}>
              {suggestions.map((u) => (
                <button key={u.id} type="button" className={styles.sendScSuggestItem} onClick={() => onPickSuggestion(u.username)}>
                  @{u.username}{u.display_name ? ` · ${u.display_name}` : ""}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.sendScField}>
          <label className={styles.sendScLabel}>Gift Item</label>
          <div className={styles.buyPkgList}>
            {GIFT_ITEMS.map((gift) => (
              <button
                key={gift.id}
                type="button"
                className={`${styles.buyPkgBtn} ${selectedGift?.id === gift.id ? styles.buyPkgBtnActive : ""}`}
                onClick={() => onPickGift(gift)}
              >
                <span className={styles.buyPkgLabel}>{gift.emoji} {gift.name}</span>
                <span className={styles.buyPkgSc}>{gift.sc} SC</span>
                <span className={styles.buyPkgPi}>Receiver gets {Math.floor(gift.sc * 0.7)} SC</span>
              </button>
            ))}
          </div>
        </div>

        <button className={styles.withdrawConfirmBtn} onClick={onConfirm} disabled={loading || !username.trim() || !selectedGift}>
          {loading ? "Sending..." : selectedGift ? `Send ${selectedGift.emoji} ${selectedGift.name}` : "Select gift"}
        </button>
        <button className={styles.modalCancelBtn} onClick={onClose} disabled={loading}>Cancel</button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function WalletPage() {
  const { user } = useAuth();
  const { isReady: piReady } = usePi();
  const router   = useRouter();

  const [activeTab, setActiveTab]       = useState<"sc" | "earnings">("earnings");
  const [data, setData]                 = useState<any>(null);
  const [loading, setLoading]           = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showBuySc, setShowBuySc] = useState(false);
  const [showTransferSc, setShowTransferSc] = useState(false);
  const [showGiftSc, setShowGiftSc] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [buyingSc, setBuyingSc] = useState(false);
  const [sendingSc, setSendingSc] = useState(false);
  const [giftingSc, setGiftingSc] = useState(false);
  const [buyPkg, setBuyPkg] = useState<(typeof SC_PACKAGES)[number] | null>(null);
  const [piRate, setPiRate] = useState(1.5);
  const [transferUsername, setTransferUsername] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferSuggestions, setTransferSuggestions] = useState<UserSuggestion[]>([]);
  const [giftUsername, setGiftUsername] = useState("");
  const [giftSuggestions, setGiftSuggestions] = useState<UserSuggestion[]>([]);
  const [giftItem, setGiftItem] = useState<(typeof GIFT_ITEMS)[number] | null>(null);
  const [toast, setToast]               = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [scPage, setScPage]             = useState(1);
  const [earnPage, setEarnPage]         = useState(1);

  const token = () => typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "";

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

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

  useEffect(() => {
    fetch("/api/pi-price")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.price) setPiRate(Number(d.price)); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const query = transferUsername.trim();
    if (!user || query.length < 2 || !showTransferSc) {
      setTransferSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        const d = await r.json();
        if (d.success) setTransferSuggestions(d.data?.users ?? []);
      } catch {}
    }, 220);
    return () => clearTimeout(timer);
  }, [transferUsername, user, showTransferSc]);

  useEffect(() => {
    const query = giftUsername.trim();
    if (!user || query.length < 2 || !showGiftSc) {
      setGiftSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        const d = await r.json();
        if (d.success) setGiftSuggestions(d.data?.users ?? []);
      } catch {}
    }, 220);
    return () => clearTimeout(timer);
  }, [giftUsername, user, showGiftSc]);

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

  const handleBuySc = async () => {
    if (!buyPkg || buyingSc) return;
    if (!piReady) return showToast("Pi SDK not ready. Please wait...", "error");
    const Pi = (window as any).Pi;
    if (!Pi) return showToast("Please open in Pi Browser", "error");

    setBuyingSc(true);
    const currentPkg = buyPkg;
    const piAmount = parseFloat((currentPkg.usd / piRate).toFixed(6));

    try {
      await Pi.authenticate(["username", "payments", "wallet_address"], async (incompletePayment: any) => {
        const base = getApiBase();
        await fetch(`${base || ""}/api/payments/incomplete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payment: incompletePayment }),
        }).catch(() => {});
      });

      Pi.createPayment(
        { amount: piAmount, memo: `Buy ${currentPkg.sc} Supapi Credits`, metadata: { pkg: currentPkg.id, sc: currentPkg.sc } },
        {
          onReadyForServerApproval: (paymentId: string) => {
            const base = getApiBase();
            fetch(`${base || ""}/api/credits/buy`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
              body: JSON.stringify({ paymentId, action: "approve" }),
            }).catch(() => {});
          },
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            try {
              const base = getApiBase();
              const r = await fetch(`${base || ""}/api/credits/buy`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
                body: JSON.stringify({ paymentId, txid, action: "complete", pkg: currentPkg.id, sc: currentPkg.sc }),
              });
              const d = await r.json();
              if (d.success) {
                showToast(`🎉 +${currentPkg.sc} SC added!`);
                fetchData("sc");
              } else showToast(d.error ?? "SC credit failed", "error");
            } catch {
              showToast("Failed to credit SC", "error");
            } finally {
              setBuyingSc(false);
              setShowBuySc(false);
              setBuyPkg(null);
            }
          },
          onCancel: () => { showToast("Payment cancelled", "error"); setBuyingSc(false); },
          onError: (err: any) => { showToast(`Payment error: ${err?.message ?? ""}`, "error"); setBuyingSc(false); },
        }
      );
    } catch (e: any) {
      showToast(`Payment error: ${e?.message ?? "Unknown"}`, "error");
      setBuyingSc(false);
    }
  };

  const handleTransferSc = async () => {
    const toUsername = transferUsername.trim();
    const amt = parseInt(transferAmount, 10);
    if (!toUsername || !amt || amt < 1 || sendingSc) return;
    if ((scWallet.balance ?? 0) < amt) {
      showToast("Insufficient SC balance", "error");
      return;
    }

    setSendingSc(true);
    try {
      const r = await fetch("/api/credits/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ toUsername, amount: amt }),
      });
      const d = await r.json();
      if (d.success) {
        showToast(`💸 ${amt} SC sent to @${toUsername}`);
        setShowTransferSc(false);
        setTransferUsername("");
        setTransferAmount("");
        setTransferSuggestions([]);
        fetchData("sc");
      } else {
        showToast(d.error ?? "Transfer failed", "error");
      }
    } catch {
      showToast("Something went wrong", "error");
    } finally {
      setSendingSc(false);
    }
  };

  const handleGiftSc = async () => {
    const toUsername = giftUsername.trim();
    if (!toUsername || !giftItem || giftingSc) return;
    if ((scWallet.balance ?? 0) < giftItem.sc) {
      showToast("Insufficient SC balance", "error");
      return;
    }
    setGiftingSc(true);
    try {
      const r = await fetch("/api/credits/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          toUsername,
          giftId: giftItem.id,
          sc: giftItem.sc,
          emoji: giftItem.emoji,
          name: giftItem.name,
        }),
      });
      const d = await r.json();
      if (d.success) {
        showToast(`${giftItem.emoji} Gift sent to @${toUsername}`);
        setShowGiftSc(false);
        setGiftUsername("");
        setGiftItem(null);
        setGiftSuggestions([]);
        fetchData("sc");
      } else {
        showToast(d.error ?? "Gift failed", "error");
      }
    } catch {
      showToast("Something went wrong", "error");
    } finally {
      setGiftingSc(false);
    }
  };

  const scWallet:       ScWallet       = data?.scWallet       ?? { balance: 0, total_earned: 0, total_spent: 0, checkin_streak: 0, last_checkin: null };
  const earningsWallet: EarningsWallet = data?.earningsWallet ?? { pending_pi: 0, available_pi: 0, total_earned: 0, total_withdrawn: 0 };
  const scTxns:         ScTxn[]        = data?.scTransactions ?? [];
  const earnTxns:       EarnTxn[]      = data?.earningsTransactions ?? [];

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
              <button type="button" className={styles.scActionBtn} onClick={() => setShowBuySc(true)}>
                <span>🛒</span> Buy SC
              </button>
              <button type="button" className={styles.scActionBtn} onClick={() => setShowGiftSc(true)}>
                <span>🎁</span> Gift SC
              </button>
              <button type="button" className={styles.scActionBtn} onClick={() => setShowTransferSc(true)}>
                <span>↔️</span> Transfer
              </button>
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
                  const amount = Number(txn.amount ?? 0);
                  const isSpend = ["spend", "gift_sent", "transfer_out"].includes(String(txn.type)) || amount < 0;
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
                          {isSpend ? "-" : "+"}{Math.abs(amount)} SC
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
      {showBuySc && (
        <BuyScModal
          piRate={piRate}
          buying={buyingSc}
          selected={buyPkg}
          onClose={() => {
            if (buyingSc) return;
            setShowBuySc(false);
            setBuyPkg(null);
          }}
          onSelect={setBuyPkg}
          onConfirm={handleBuySc}
        />
      )}
      {showTransferSc && (
        <SendScModal
          loading={sendingSc}
          username={transferUsername}
          amount={transferAmount}
          balance={Number(scWallet.balance ?? 0)}
          onClose={() => {
            if (sendingSc) return;
            setShowTransferSc(false);
            setTransferSuggestions([]);
          }}
          onChangeUsername={setTransferUsername}
          onChangeAmount={setTransferAmount}
          suggestions={transferSuggestions}
          onPickSuggestion={(u) => {
            setTransferUsername(u);
            setTransferSuggestions([]);
          }}
          onConfirm={handleTransferSc}
        />
      )}
      {showGiftSc && (
        <GiftScModal
          loading={giftingSc}
          username={giftUsername}
          selectedGift={giftItem}
          suggestions={giftSuggestions}
          onClose={() => {
            if (giftingSc) return;
            setShowGiftSc(false);
            setGiftSuggestions([]);
          }}
          onChangeUsername={setGiftUsername}
          onPickSuggestion={(u) => {
            setGiftUsername(u);
            setGiftSuggestions([]);
          }}
          onPickGift={setGiftItem}
          onConfirm={handleGiftSc}
        />
      )}
    </div>
  );
}
