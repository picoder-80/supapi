"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./page.module.css";

const SC_PACKAGES = [
  { id: "starter", sc: 100,  usd: 1.00, label: "Starter",  popular: false },
  { id: "popular", sc: 500,  usd: 5.00, label: "Popular",  popular: true  },
  { id: "pro",     sc: 1000, usd: 10.00, label: "Pro",     popular: false },
  { id: "whale",   sc: 5000, usd: 50.00, label: "Whale",   popular: false },
];

interface Wallet {
  balance: number;
  total_earned: number;
  total_spent: number;
  last_checkin: string | null;
  checkin_streak: number;
}

interface Transaction {
  id: string;
  type: string;
  activity: string;
  amount: number;
  balance_after: number;
  note: string;
  created_at: string;
  ref_user?: { username: string; avatar_url: string | null } | null;
}

const ACTIVITY_META: Record<string, { emoji: string; label: string }> = {
  daily_checkin:    { emoji: "📅", label: "Daily Check-in" },
  streak_bonus:     { emoji: "🔥", label: "Streak Bonus" },
  complete_profile: { emoji: "👤", label: "Complete Profile" },
  first_listing:    { emoji: "🏪", label: "First Listing" },
  review:           { emoji: "⭐", label: "Review" },
  watch_reels:      { emoji: "🎬", label: "Watch Reels" },
  transfer:         { emoji: "💸", label: "Transfer" },
  gift:             { emoji: "🎁", label: "Gift" },
};

const EARN_TASKS = [
  { activity: "daily_checkin",    emoji: "📅", label: "Daily Check-in",    sc: 10,  repeat: true,  desc: "Check in every day" },
  { activity: "streak_bonus",     emoji: "🔥", label: "7-Day Streak",      sc: 50,  repeat: true,  desc: "Check in 7 days in a row" },
  { activity: "complete_profile", emoji: "👤", label: "Complete Profile",  sc: 100, repeat: false, desc: "Add avatar, bio & display name" },
  { activity: "first_listing",    emoji: "🏪", label: "First Listing",     sc: 50,  repeat: false, desc: "Post your first item or gig" },
  { activity: "review",           emoji: "⭐", label: "Leave a Review",    sc: 20,  repeat: true,  desc: "Rate a business or seller" },
  { activity: "watch_reels",      emoji: "🎬", label: "Watch 5 Reels",     sc: 10,  repeat: true,  desc: "Watch 5 reels in Content" },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function RewardsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [canCheckin, setCanCheckin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [claimedActivities, setClaimedActivities] = useState<Set<string>>(new Set());
  const [piRate, setPiRate] = useState<number>(1.50); // Pi/USD rate
  const [buyPkg, setBuyPkg] = useState<typeof SC_PACKAGES[0] | null>(null);
  const [buying, setBuying] = useState(false);

  const token = () => typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "";

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const [creditsRes, rateRes] = await Promise.all([
        fetch("/api/credits", { headers: { Authorization: `Bearer ${token()}` } }),
        fetch("/api/pi-price").catch(() => null),
      ]);
      const d = await creditsRes.json();
      if (d.success) {
        setWallet(d.data.wallet);
        setTransactions(d.data.transactions);
        setCanCheckin(d.data.canCheckin);
        const claimed = new Set<string>();
        d.data.transactions.forEach((tx: Transaction) => {
          if (["complete_profile", "first_listing"].includes(tx.activity)) claimed.add(tx.activity);
        });
        setClaimedActivities(claimed);
      }
      if (rateRes?.ok) {
        const rd = await rateRes.json();
        if (rd?.price) setPiRate(Number(rd.price));
      }
    } catch {}
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCheckin = async () => {
    if (!canCheckin || checking) return;
    setChecking(true);
    try {
      const r = await fetch("/api/credits/checkin", {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (d.success) {
        showToast(d.data.message);
        fetchData();
      } else {
        showToast(d.error ?? "Failed", "error");
      }
    } catch {
      showToast("Something went wrong", "error");
    }
    setChecking(false);
  };

  const handleBuy = async () => {
    if (!buyPkg || buying) return;
    setBuying(true);
    const piAmount = parseFloat((buyPkg.usd / piRate).toFixed(6));
    try {
      const Pi = (window as any).Pi;
      if (!Pi) { showToast("Please open in Pi Browser", "error"); setBuying(false); return; }

      const payment = await Pi.createPayment({
        amount: piAmount,
        memo: `Buy ${buyPkg.sc} Supapi Credits`,
        metadata: { pkg: buyPkg.id, sc: buyPkg.sc, userId: user?.id },
      }, {
        onReadyForServerApproval: async (paymentId: string) => {
          await fetch("/api/credits/buy", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
            body: JSON.stringify({ paymentId, action: "approve" }),
          });
        },
        onReadyForServerCompletion: async (paymentId: string, txid: string) => {
          const r = await fetch("/api/credits/buy", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
            body: JSON.stringify({ paymentId, txid, action: "complete", pkg: buyPkg.id, sc: buyPkg.sc }),
          });
          const d = await r.json();
          if (d.success) {
            showToast(`🎉 +${buyPkg.sc} SC added to your wallet!`);
            fetchData();
          }
          setBuyPkg(null);
        },
        onCancel: () => { showToast("Payment cancelled", "error"); setBuyPkg(null); },
        onError: (err: any) => { showToast("Payment failed", "error"); console.error(err); setBuyPkg(null); },
      });
    } catch (e) {
      showToast("Payment error", "error");
    }
    setBuying(false);
  };

  const streakDays = Array.from({ length: 7 }, (_, i) => i + 1);
  const currentStreak = wallet?.checkin_streak ?? 0;

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.loginPrompt}>
          <div className={styles.loginIcon}>🎁</div>
          <h2 className={styles.loginTitle}>Sign in to earn Supapi Credits</h2>
          <p className={styles.loginSub}>Check in daily, complete tasks, and earn SC to use across the platform.</p>
          <button className={styles.loginBtn} onClick={() => router.push("/dashboard")}>
            π Sign in with Pi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>

      {/* Toast */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.headerTitle}>🎁 Daily Rewards</h1>
        </div>
      </div>

      {/* SC Balance Card */}
      <div className={styles.balanceSection}>
        <div className={styles.balanceCard}>
          <div className={styles.balanceLabel}>Your Supapi Credits</div>
          <div className={styles.balanceAmount}>
            <span className={styles.balanceCoin}>💎</span>
            <span className={styles.balanceNum}>{loading ? "..." : (wallet?.balance ?? 0).toLocaleString()}</span>
            <span className={styles.balanceSc}>SC</span>
          </div>
          <div className={styles.balanceStats}>
            <div className={styles.balanceStat}>
              <span className={styles.balanceStatNum}>{wallet?.total_earned ?? 0}</span>
              <span className={styles.balanceStatLabel}>Total Earned</span>
            </div>
            <div className={styles.balanceStatDivider} />
            <div className={styles.balanceStat}>
              <span className={styles.balanceStatNum}>{wallet?.total_spent ?? 0}</span>
              <span className={styles.balanceStatLabel}>Total Spent</span>
            </div>
            <div className={styles.balanceStatDivider} />
            <div className={styles.balanceStat}>
              <span className={styles.balanceStatNum}>{currentStreak}</span>
              <span className={styles.balanceStatLabel}>Day Streak 🔥</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.body}>

        {/* Daily Check-in */}
        <div className={styles.checkinCard}>
          <div className={styles.checkinHeader}>
            <div>
              <div className={styles.checkinTitle}>📅 Daily Check-in</div>
              <div className={styles.checkinSub}>Check in every day to earn SC. 7-day streak = bonus!</div>
            </div>
            <div className={styles.checkinReward}>+10 SC</div>
          </div>

          {/* Streak tracker */}
          <div className={styles.streakRow}>
            {streakDays.map(day => (
              <div
                key={day}
                className={`${styles.streakDay} ${day <= currentStreak % 7 || (currentStreak > 0 && currentStreak % 7 === 0 && day === 7) ? styles.streakDayDone : ""} ${day === 7 ? styles.streakDayBonus : ""}`}
              >
                <div className={styles.streakDayNum}>{day}</div>
                <div className={styles.streakDayIcon}>{day === 7 ? "🔥" : "⭐"}</div>
                {day === 7 && <div className={styles.streakBonusLabel}>+50</div>}
              </div>
            ))}
          </div>

          <button
            className={`${styles.checkinBtn} ${!canCheckin ? styles.checkinBtnDone : ""}`}
            onClick={handleCheckin}
            disabled={!canCheckin || checking}
          >
            {checking ? "Checking in..." : canCheckin ? "✅ Check In Now" : "✓ Checked In Today"}
          </button>
        </div>

        {/* Earn Tasks */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>💰 Earn More SC</div>
          <div className={styles.taskList}>
            {EARN_TASKS.filter(t => t.activity !== "daily_checkin" && t.activity !== "streak_bonus").map(task => {
              const claimed = !task.repeat && claimedActivities.has(task.activity);
              return (
                <div key={task.activity} className={`${styles.taskCard} ${claimed ? styles.taskCardDone : ""}`}>
                  <div className={styles.taskEmoji}>{task.emoji}</div>
                  <div className={styles.taskInfo}>
                    <div className={styles.taskLabel}>{task.label}</div>
                    <div className={styles.taskDesc}>{task.desc}</div>
                  </div>
                  <div className={styles.taskRight}>
                    <div className={styles.taskSc}>+{task.sc} SC</div>
                    {claimed
                      ? <div className={styles.taskDoneBadge}>✓ Done</div>
                      : <div className={styles.taskRepeat}>{task.repeat ? "Repeatable" : "One-time"}</div>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Buy SC with Pi */}
        <div className={styles.buySection}>
          <div className={styles.sectionTitle}>💎 Buy Supapi Credits</div>
          <div className={styles.piRateBadge}>
            <div className={styles.piRateDot} />
            <span>1 Pi ≈ ${piRate.toFixed(2)} USD · Live rate</span>
          </div>
          <div className={styles.packageGrid}>
            {SC_PACKAGES.map(pkg => {
              const piNeeded = (pkg.usd / piRate).toFixed(3);
              return (
                <div
                  key={pkg.id}
                  className={`${styles.packageCard} ${pkg.popular ? styles.packageCardPopular : ""}`}
                  onClick={() => setBuyPkg(pkg)}
                >
                  {pkg.popular && <div className={styles.packagePopularBadge}>⭐ Popular</div>}
                  <div className={styles.packageSc}>{pkg.sc.toLocaleString()}</div>
                  <div className={styles.packageScLabel}>SC</div>
                  <div className={styles.packageUsd}>${pkg.usd.toFixed(2)} USD</div>
                  <div className={styles.packagePi}>π {piNeeded} Pi</div>
                  <button className={styles.packageBtn}>Buy Now</button>
                </div>
              );
            })}
          </div>
          <div className={styles.packageNote}>
            💡 1 SC = $0.01 USD · Rate updates live · Pi paid goes to Supapi treasury
          </div>
        </div>

        {/* Transaction History */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>📋 History</div>
          {transactions.length === 0 ? (
            <div className={styles.emptyHistory}>
              <div className={styles.emptyIcon}>📭</div>
              <div className={styles.emptyText}>No transactions yet. Start earning!</div>
            </div>
          ) : (
            <div className={styles.txList}>
              {transactions.map(tx => {
                const meta = ACTIVITY_META[tx.activity] ?? { emoji: "💎", label: tx.activity };
                const isEarn = tx.type === "earn" || tx.type === "transfer_in" || tx.type === "gift_received";
                return (
                  <div key={tx.id} className={styles.txRow}>
                    <div className={styles.txEmoji}>{meta.emoji}</div>
                    <div className={styles.txInfo}>
                      <div className={styles.txLabel}>{tx.note || meta.label}</div>
                      <div className={styles.txTime}>{timeAgo(tx.created_at)}</div>
                    </div>
                    <div className={`${styles.txAmount} ${isEarn ? styles.txEarn : styles.txSpend}`}>
                      {isEarn ? "+" : "-"}{Math.abs(tx.amount)} SC
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
      {/* Buy Modal */}
      {buyPkg && (
        <div className={styles.buyModal}>
          <div className={styles.buyModalBackdrop} onClick={() => !buying && setBuyPkg(null)} />
          <div className={styles.buyModalSheet}>
            <div className={styles.buyModalHandle} />
            <div className={styles.buyModalTitle}>💎 Buy {buyPkg.sc.toLocaleString()} SC</div>
            <div className={styles.buyModalSub}>Confirm your purchase with Pi</div>
            <div className={styles.buyModalInfo}>
              <div className={styles.buyModalRow}>
                <span className={styles.buyModalRowLabel}>Package</span>
                <span className={styles.buyModalRowVal}>{buyPkg.label} — {buyPkg.sc.toLocaleString()} SC</span>
              </div>
              <div className={styles.buyModalRow}>
                <span className={styles.buyModalRowLabel}>USD Value</span>
                <span className={styles.buyModalRowVal}>${buyPkg.usd.toFixed(2)}</span>
              </div>
              <div className={styles.buyModalRow}>
                <span className={styles.buyModalRowLabel}>Pi Rate</span>
                <span className={styles.buyModalRowVal}>1 Pi ≈ ${piRate.toFixed(2)}</span>
              </div>
              <div className={styles.buyModalRow}>
                <span className={styles.buyModalRowLabel}>You Pay</span>
                <span className={styles.buyModalRowValGold}>π {(buyPkg.usd / piRate).toFixed(3)} Pi</span>
              </div>
              <div className={styles.buyModalRow}>
                <span className={styles.buyModalRowLabel}>You Get</span>
                <span className={styles.buyModalRowValGold}>💎 {buyPkg.sc.toLocaleString()} SC</span>
              </div>
            </div>
            <button
              className={styles.buyModalConfirmBtn}
              onClick={handleBuy}
              disabled={buying}
            >
              {buying ? "Processing..." : `Pay π ${(buyPkg.usd / piRate).toFixed(3)} Pi`}
            </button>
            <button className={styles.buyModalCancelBtn} onClick={() => setBuyPkg(null)} disabled={buying}>
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
