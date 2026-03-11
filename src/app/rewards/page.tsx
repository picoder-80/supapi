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

const GIFT_ITEMS = [
  { id: "rose",      emoji: "🌹", name: "Rose",       sc: 10  },
  { id: "heart",     emoji: "💖", name: "Heart",      sc: 20  },
  { id: "star",      emoji: "⭐", name: "Star",       sc: 50  },
  { id: "crown",     emoji: "👑", name: "Crown",      sc: 100 },
  { id: "diamond",   emoji: "💎", name: "Diamond",    sc: 200 },
  { id: "rocket",    emoji: "🚀", name: "Rocket",     sc: 500 },
  { id: "trophy",    emoji: "🏆", name: "Trophy",     sc: 1000},
  { id: "unicorn",   emoji: "🦄", name: "Unicorn",    sc: 2000},
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
  // Phase 3 — Gift & Transfer
  const [giftItem, setGiftItem] = useState<typeof GIFT_ITEMS[0] | null>(null);
  const [giftUsername, setGiftUsername] = useState("");
  const [gifting, setGifting] = useState(false);
  const [transferUsername, setTransferUsername] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferring, setTransferring] = useState(false);

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
    const Pi = (window as any).Pi;
    if (!Pi) { showToast("Please open in Pi Browser", "error"); return; }
    setBuying(true);
    const currentPkg = buyPkg;
    const piAmount = parseFloat((currentPkg.usd / piRate).toFixed(6));
    try {
      Pi.createPayment(
        {
          amount:   piAmount,
          memo:     `Buy ${currentPkg.sc} Supapi Credits`,
          metadata: { pkg: currentPkg.id, sc: currentPkg.sc },
        },
        {
          // FIRE AND FORGET — do NOT await
          onReadyForServerApproval: (paymentId: string) => {
            fetch("/api/credits/buy", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
              body: JSON.stringify({ paymentId, action: "approve" }),
            }).catch(console.error);
          },
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            try {
              const r = await fetch("/api/credits/buy", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
                body: JSON.stringify({ paymentId, txid, action: "complete", pkg: currentPkg.id, sc: currentPkg.sc }),
              });
              const d = await r.json();
              if (d.success) {
                showToast(`🎉 +${currentPkg.sc} SC added to your wallet!`);
                fetchData();
              } else {
                showToast(d.error ?? "SC credit failed", "error");
              }
            } catch {
              showToast("Failed to credit SC", "error");
            }
            setBuyPkg(null);
            setBuying(false);
          },
          onCancel: () => { showToast("Payment cancelled", "error"); setBuyPkg(null); setBuying(false); },
          onError:  (err: any) => { showToast("Payment error: " + (err?.message ?? ""), "error"); setBuyPkg(null); setBuying(false); },
        }
      );
    } catch (e: any) {
      showToast("Payment error: " + (e?.message ?? "Unknown"), "error");
      setBuying(false);
    }
  };

  const handleGift = async () => {
    if (!giftItem || !giftUsername.trim() || gifting) return;
    if ((wallet?.balance ?? 0) < giftItem.sc) { showToast("Insufficient SC balance", "error"); return; }
    setGifting(true);
    try {
      const r = await fetch("/api/credits/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ toUsername: giftUsername.trim(), giftId: giftItem.id, sc: giftItem.sc, emoji: giftItem.emoji, name: giftItem.name }),
      });
      const d = await r.json();
      if (d.success) {
        showToast(`${giftItem.emoji} Gift sent to @${giftUsername}!`);
        setGiftItem(null);
        setGiftUsername("");
        fetchData();
      } else {
        showToast(d.error ?? "Gift failed", "error");
      }
    } catch { showToast("Something went wrong", "error"); }
    setGifting(false);
  };

  const handleTransfer = async () => {
    const amt = parseInt(transferAmount);
    if (!transferUsername.trim() || !amt || amt < 1 || transferring) return;
    if ((wallet?.balance ?? 0) < amt) { showToast("Insufficient SC balance", "error"); return; }
    setTransferring(true);
    try {
      const r = await fetch("/api/credits/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ toUsername: transferUsername.trim(), amount: amt }),
      });
      const d = await r.json();
      if (d.success) {
        showToast(`💸 ${amt} SC sent to @${transferUsername}!`);
        setTransferUsername("");
        setTransferAmount("");
        fetchData();
      } else {
        showToast(d.error ?? "Transfer failed", "error");
      }
    } catch { showToast("Something went wrong", "error"); }
    setTransferring(false);
  };

  const streakDays = Array.from({ length: 7 }, (_, i) => i + 1);
  const currentStreak = wallet?.checkin_streak ?? 0;

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.introPage}>

          {/* ── Hero ── */}
          <div className={styles.introHero}>
            <div className={styles.introHeroBg} />
            <div className={styles.introHeroContent}>
              <div className={styles.introBadge}>✨ Introducing</div>
              <div className={styles.introCoin}>💎</div>
              <h1 className={styles.introTitle}>Supapi Credits</h1>
              <p className={styles.introSub}>The exclusive reward currency for Pi Network Pioneers</p>
              <div className={styles.introValueRow}>
                <div className={styles.introValueTag}>💎 1 SC = $0.01 USD</div>
              </div>
              <p className={styles.introHeroNote}>Earn · Spend · Gift — across the Pi ecosystem</p>
            </div>
          </div>

          {/* ── What is SC ── */}
          <div className={styles.introWhatBox}>
            <div className={styles.introWhatTitle}>💡 What are Supapi Credits (SC)?</div>
            <p className={styles.introWhatDesc}>
              SC is Supapi's in-platform currency that you can earn for free through daily activities,
              buy with Pi, gift to fellow Pioneers, and use across all Supapi platforms.
              SC value is pegged to USD — stable and trustworthy.
            </p>
          </div>

          {/* ── How to Use SC ── */}
          <div className={styles.introSection}>
            <div className={styles.introSectionTitle}>🎯 What can you do with SC?</div>
            <div className={styles.introUseCases}>
              <div className={styles.introUseCard}>
                <div className={styles.introUseEmoji}>🎁</div>
                <div className={styles.introUseTitle}>Hadiahkan Creator</div>
                <div className={styles.introUseDesc}>Support your favourite Reels & LIVE creators. 70% goes directly to the creator.</div>
              </div>
              <div className={styles.introUseCard}>
                <div className={styles.introUseEmoji}>💸</div>
                <div className={styles.introUseTitle}>Send to Any Pioneer</div>
                <div className={styles.introUseDesc}>Transfer SC to any Pioneer for free. 0% fee, instant.</div>
              </div>
              <div className={styles.introUseCard}>
                <div className={styles.introUseEmoji}>⭐</div>
                <div className={styles.introUseTitle}>Boost Listing</div>
                <div className={styles.introUseDesc}>Use SC to boost your Marketplace & Gigs listings to the top. <span className={styles.introComingSoon}>Coming Soon</span></div>
              </div>
              <div className={styles.introUseCard}>
                <div className={styles.introUseEmoji}>🏆</div>
                <div className={styles.introUseTitle}>Leaderboard & Status</div>
                <div className={styles.introUseDesc}>Pioneers with the most SC earn exclusive badges & platform priority. <span className={styles.introComingSoon}>Coming Soon</span></div>
              </div>
              <div className={styles.introUseCard}>
                <div className={styles.introUseEmoji}>🎮</div>
                <div className={styles.introUseTitle}>Main Arcade</div>
                <div className={styles.introUseDesc}>Use SC as entry tickets for games in Supapi Arcade. <span className={styles.introComingSoon}>Coming Soon</span></div>
              </div>
              <div className={styles.introUseCard}>
                <div className={styles.introUseEmoji}>📚</div>
                <div className={styles.introUseTitle}>Unlock Premium Courses</div>
                <div className={styles.introUseDesc}>Unlock exclusive courses on Supapi Academy using SC. <span className={styles.introComingSoon}>Coming Soon</span></div>
              </div>
            </div>
          </div>

          {/* ── Earn SC ── */}
          <div className={styles.introEarnBox}>
            <div className={styles.introEarnTitle}>🚀 How to earn SC — completely free!</div>
            <div className={styles.introEarnRow}>
              <span>📅 Daily check-in</span><span className={styles.introEarnSc}>+10 SC</span>
            </div>
            <div className={styles.introEarnRow}>
              <span>🔥 7-day streak bonus</span><span className={styles.introEarnSc}>+50 SC</span>
            </div>
            <div className={styles.introEarnRow}>
              <span>👤 Complete your profile</span><span className={styles.introEarnSc}>+100 SC</span>
            </div>
            <div className={styles.introEarnRow}>
              <span>🏪 First listing</span><span className={styles.introEarnSc}>+50 SC</span>
            </div>
            <div className={styles.introEarnRow}>
              <span>⭐ Leave a review</span><span className={styles.introEarnSc}>+20 SC</span>
            </div>
            <div className={styles.introEarnRow}>
              <span>🎬 Watch 5 Reels</span><span className={styles.introEarnSc}>+10 SC</span>
            </div>
            <div className={styles.introEarnNote}>+ Or buy SC with Pi anytime</div>
          </div>

          {/* ── Why SC ── */}
          <div className={styles.introWhyBox}>
            <div className={styles.introWhyTitle}>🌟 Why SC is better than ordinary loyalty points</div>
            <div className={styles.introWhyList}>
              <div className={styles.introWhyItem}><span className={styles.introWhyCheck}>✅</span><span>Value pegged to USD — not empty numbers</span></div>
              <div className={styles.introWhyItem}><span className={styles.introWhyCheck}>✅</span><span>Send to any Pioneer anytime</span></div>
              <div className={styles.introWhyItem}><span className={styles.introWhyCheck}>✅</span><span>Creators receive 70% of every Gift sent to them</span></div>
              <div className={styles.introWhyItem}><span className={styles.introWhyCheck}>✅</span><span>Buy directly using Pi</span></div>
              <div className={styles.introWhyItem}><span className={styles.introWhyCheck}>✅</span><span>Usable across all 16 Supapi platforms</span></div>
              <div className={styles.introWhyItem}><span className={styles.introWhyCheck}>✅</span><span>100% free to earn every single day</span></div>
            </div>
          </div>

          {/* ── CTA ── */}
          <div className={styles.introCta}>
            <button className={styles.introCtaBtn} onClick={() => router.push("/dashboard")}>
              π Sign in with Pi — Start Earning SC
            </button>
            <p className={styles.introCtaNote}>Free forever · Exclusive to Pi Network Pioneers</p>
          </div>

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

        {/* Gift */}
        <div className={styles.giftSection}>
          <div className={styles.sectionTitle}>🎁 Send a Gift</div>
          <div className={styles.giftInfoBox}>
            <div className={styles.giftInfoIcon}>🎁</div>
            <div>
              <div className={styles.giftInfoTitle}>Gift SC to Creators & Pioneers</div>
              <div className={styles.giftInfoDesc}>Send gifts during LIVE, on Reels, or directly to any Pioneer's profile. Creators receive 70% of the SC value.</div>
              <div className={styles.giftInfoSplit}>
                <span className={`${styles.giftSplitTag} ${styles.giftSplitCreator}`}>👤 Creator 70%</span>
                <span className={`${styles.giftSplitTag} ${styles.giftSplitPlatform}`}>🏛️ Supapi 30%</span>
              </div>
            </div>
          </div>
          <div className={styles.giftGrid}>
            {GIFT_ITEMS.map(g => (
              <div key={g.id} className={styles.giftItem} onClick={() => setGiftItem(g)}>
                <div className={styles.giftItemEmoji}>{g.emoji}</div>
                <div className={styles.giftItemName}>{g.name}</div>
                <div className={styles.giftItemSc}>{g.sc} SC</div>
              </div>
            ))}
          </div>
        </div>

        {/* Transfer */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>💸 Transfer SC</div>
          <div className={styles.transferCard}>
            <div className={styles.transferTitle}>Send SC to Any Pioneer</div>
            <div className={styles.transferSub}>Free P2P transfer within Supapi ecosystem · 0% fee</div>
            <div className={styles.transferRow}>
              <input
                className={styles.transferInput}
                placeholder="@username"
                value={transferUsername}
                onChange={e => setTransferUsername(e.target.value.replace("@", ""))}
              />
            </div>
            <div className={styles.transferAmountRow}>
              <input
                className={styles.transferAmountInput}
                placeholder="Amount (SC)"
                type="number"
                min="1"
                value={transferAmount}
                onChange={e => setTransferAmount(e.target.value)}
              />
              <button
                className={styles.transferBtn}
                onClick={handleTransfer}
                disabled={transferring || !transferUsername || !transferAmount}
              >
                {transferring ? "Sending..." : "Send →"}
              </button>
            </div>
            <div className={styles.transferNote}>Your balance: 💎 {(wallet?.balance ?? 0).toLocaleString()} SC</div>
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
      {/* Gift Modal */}
      {giftItem && (
        <div className={styles.giftModal}>
          <div className={styles.giftModalBackdrop} onClick={() => !gifting && setGiftItem(null)} />
          <div className={styles.giftModalSheet}>
            <div className={styles.giftModalHandle} />
            <div className={styles.giftModalEmoji}>{giftItem.emoji}</div>
            <div className={styles.giftModalTitle}>Send {giftItem.name}</div>
            <div className={styles.giftModalSub}>Gift {giftItem.sc} SC to a Pioneer or Creator</div>
            <input
              className={styles.giftUsernameInput}
              placeholder="Enter @username"
              value={giftUsername}
              onChange={e => setGiftUsername(e.target.value.replace("@", ""))}
            />
            <div className={styles.giftModalInfo}>
              <div className={styles.giftModalRow}>
                <span className={styles.giftModalLabel}>Gift</span>
                <span className={styles.giftModalVal}>{giftItem.emoji} {giftItem.name}</span>
              </div>
              <div className={styles.giftModalRow}>
                <span className={styles.giftModalLabel}>Cost</span>
                <span className={styles.giftModalValGold}>💎 {giftItem.sc} SC</span>
              </div>
              <div className={styles.giftModalRow}>
                <span className={styles.giftModalLabel}>Creator gets</span>
                <span className={styles.giftModalVal}>{Math.floor(giftItem.sc * 0.7)} SC (70%)</span>
              </div>
              <div className={styles.giftModalRow}>
                <span className={styles.giftModalLabel}>Your balance after</span>
                <span className={styles.giftModalVal}>💎 {((wallet?.balance ?? 0) - giftItem.sc).toLocaleString()} SC</span>
              </div>
            </div>
            <button
              className={styles.giftModalConfirmBtn}
              onClick={handleGift}
              disabled={gifting || !giftUsername.trim() || (wallet?.balance ?? 0) < giftItem.sc}
            >
              {gifting ? "Sending..." : `Send ${giftItem.emoji} Gift`}
            </button>
            <button className={styles.giftModalCancelBtn} onClick={() => setGiftItem(null)} disabled={gifting}>
              Cancel
            </button>
          </div>
        </div>
      )}

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
