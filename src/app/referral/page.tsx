"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import ReferralWithdraw from "@/components/ReferralWithdraw";
import styles from "./page.module.css";

// ── Types ──────────────────────────────────────────────────────────────
interface ReferralStats {
  total_referrals: number; network_size: number;
  total_earned_pi: number; pending_pi: number; paid_pi: number; rank: string;
}
interface Config {
  referral_l1_pct: number; referral_l2_pct: number; referral_l3_pct: number;
  referral_monthly_cap: number; referral_hold_days: number;
}
interface Earning {
  id: string; level: number; platform: string; earned_pi: number;
  rate_pct: number; status: string; created_at: string;
  source_user?: { username: string };
}
interface Referral {
  id: string; created_at: string;
  referred: { id: string; username: string; avatar_url: string | null; display_name: string | null };
}
interface LeaderEntry {
  user_id: string; total_earned_pi: number; total_referrals: number; rank: string;
  users: { username: string; avatar_url: string | null; display_name: string | null };
}

const RANKS = [
  { key: "pioneer", label: "Pioneer",  emoji: "🥉", color: "#cd7f32", req: "Join Supapi"                   },
  { key: "builder", label: "Builder",  emoji: "🥈", color: "#9e9e9e", req: "10 referrals + 5π earned"      },
  { key: "leader",  label: "Leader",   emoji: "🥇", color: "#F5A623", req: "50 network + 25π earned"       },
  { key: "diamond", label: "Diamond",  emoji: "💎", color: "#2980b9", req: "200 network + 100π earned"     },
];

const PLATFORMS: Record<string, string> = {
  marketplace: "🛍️", academy: "📚", stay: "🏡", gigs: "💼",
  arcade: "🎮", wallet: "💰",
};

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }
function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

const TABS = ["overview", "how-it-works", "earnings", "team", "leaderboard"] as const;
type Tab = typeof TABS[number];

export default function ReferralPage() {
  const { user, login, isLoading } = useAuth();
  const [tab, setTab]               = useState<Tab>("overview");
  const [stats, setStats]           = useState<ReferralStats | null>(null);
  const [config, setConfig]         = useState<Config | null>(null);
  const [earnings, setEarnings]     = useState<Earning[]>([]);
  const [referrals, setReferrals]   = useState<Referral[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [refCode, setRefCode]       = useState("");
  const [loading, setLoading]       = useState(true);
  const [copied, setCopied]         = useState(false);

  const load = useCallback(async () => {
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch("/api/referral", { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.success) {
        setStats(d.data.stats);
        setConfig(d.data.config);
        setEarnings(d.data.earnings);
        setReferrals(d.data.referrals);
        setLeaderboard(d.data.leaderboard);
        setRefCode(d.data.ref_code);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const refLink = `https://supapi.app?ref=${refCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: "Join Supapi", text: `Join me on Supapi — the Pi Network Super App! ${refLink}`, url: refLink });
    } else handleCopy();
  };

  const rank      = RANKS.find(r => r.key === stats?.rank) ?? RANKS[0];
  const nextRank  = RANKS[RANKS.indexOf(rank) + 1];

  // ── Guest ──────────────────────────────────────────────────────────
  if (!user) return (
    <div className={styles.guestPage}>
      <div className={styles.guestHero}>
        <div className={styles.guestEmoji}>🤝</div>
        <h1 className={styles.guestTitle}>Earn Pi Every Time Your Friends Spend</h1>
        <p className={styles.guestSub}>Refer friends to Supapi. Earn commission automatically — forever.</p>
        <button className={styles.guestBtn} onClick={() => login()} disabled={isLoading}>
          {isLoading ? "Connecting..." : "π Sign in to Start Earning"}
        </button>
      </div>
      <HowItWorksSection config={null} />
    </div>
  );

  return (
    <div className={styles.page}>

      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroTop}>
          <div className={styles.rankBadge} style={{ background: `${rank.color}20`, borderColor: `${rank.color}50` }}>
            <span>{rank.emoji}</span>
            <span style={{ color: rank.color }}>{rank.label}</span>
          </div>
          {nextRank && (
            <div className={styles.nextRank}>Next: {nextRank.emoji} {nextRank.label}</div>
          )}
        </div>

        <div className={styles.heroEarnings}>
          <div className={styles.heroEarningsMain}>{(stats?.total_earned_pi ?? 0).toFixed(4)} π</div>
          <div className={styles.heroEarningsSub}>Total Earned</div>
        </div>

        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <div className={styles.heroStatVal}>{stats?.total_referrals ?? 0}</div>
            <div className={styles.heroStatLabel}>Direct</div>
          </div>
          <div className={styles.heroStatDiv} />
          <div className={styles.heroStat}>
            <div className={styles.heroStatVal}>{stats?.network_size ?? 0}</div>
            <div className={styles.heroStatLabel}>Network</div>
          </div>
          <div className={styles.heroStatDiv} />
          <div className={styles.heroStat}>
            <div className={styles.heroStatVal}>{(stats?.pending_pi ?? 0).toFixed(2)}π</div>
            <div className={styles.heroStatLabel}>Pending</div>
          </div>
        </div>

        {/* Ref link */}
        <div className={styles.refLinkBox}>
          <div className={styles.refLink}>{refLink}</div>
          <div className={styles.refLinkBtns}>
            <button className={styles.copyBtn} onClick={handleCopy}>
              {copied ? "✅ Copied!" : "📋 Copy"}
            </button>
            <button className={styles.shareBtn} onClick={handleShare}>
              🚀 Share
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {[
          { key: "overview",      label: "Overview"   },
          { key: "how-it-works",  label: "How it works" },
          { key: "earnings",      label: "Earnings"   },
          { key: "team",          label: "My Team"    },
          { key: "leaderboard",   label: "Leaderboard"},
        ].map(t => (
          <button key={t.key} className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
            onClick={() => setTab(t.key as Tab)}>{t.label}</button>
        ))}
      </div>

      <div className={styles.body}>

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <>
            {/* Commission rates card */}
            <div className={styles.ratesCard}>
              <div className={styles.ratesTitle}>💰 Your Commission Rates</div>
              <div className={styles.ratesRow}>
                <div className={styles.rateItem}>
                  <div className={styles.rateLevel}>Level 1</div>
                  <div className={styles.ratePct} style={{ color: "#F5A623" }}>{config?.referral_l1_pct ?? 5}%</div>
                  <div className={styles.rateDesc}>Direct referral</div>
                </div>
                <div className={styles.rateArrow}>→</div>
                <div className={styles.rateItem}>
                  <div className={styles.rateLevel}>Level 2</div>
                  <div className={styles.ratePct} style={{ color: "#e67e22" }}>{config?.referral_l2_pct ?? 2}%</div>
                  <div className={styles.rateDesc}>Their referral</div>
                </div>
                <div className={styles.rateArrow}>→</div>
                <div className={styles.rateItem}>
                  <div className={styles.rateLevel}>Level 3</div>
                  <div className={styles.ratePct} style={{ color: "#d35400" }}>{config?.referral_l3_pct ?? 1}%</div>
                  <div className={styles.rateDesc}>Deep network</div>
                </div>
              </div>
              <div className={styles.ratesNote}>
                Commission calculated from <b>platform fee</b> only — not from the seller's pocket.
                Cap: <b>{config?.referral_monthly_cap ?? 50}π</b> per month.
              </div>
            </div>

            {/* Rank progress */}
            <div className={styles.rankCard}>
              <div className={styles.rankCardTitle}>🏆 Rank Progress</div>
              <div className={styles.rankList}>
                {RANKS.map((r, i) => {
                  const isCurrent = r.key === stats?.rank;
                  const isPast    = RANKS.indexOf(rank) > i;
                  return (
                    <div key={r.key} className={`${styles.rankRow} ${isCurrent ? styles.rankRowActive : ""} ${isPast ? styles.rankRowDone : ""}`}>
                      <div className={styles.rankEmoji}>{r.emoji}</div>
                      <div className={styles.rankInfo}>
                        <div className={styles.rankName} style={isCurrent ? { color: r.color } : {}}>{r.label}</div>
                        <div className={styles.rankReq}>{r.req}</div>
                      </div>
                      {(isCurrent || isPast) && (
                        <div className={styles.rankCheck} style={{ color: r.color }}>{isPast ? "✅" : "◉"}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Example calculator */}
            <EarningsCalculator config={config} />
          </>
        )}

        {/* ── HOW IT WORKS ── */}
        {tab === "how-it-works" && <HowItWorksSection config={config} />}

        {/* ── EARNINGS ── */}
        {tab === "earnings" && (
          <div className={styles.earningsList}>
            <ReferralWithdraw />
            <div className={styles.earningsSummary}>
              <div className={styles.summaryCard}>
                <div className={styles.summaryVal}>{(stats?.pending_pi ?? 0).toFixed(4)}π</div>
                <div className={styles.summaryLabel}>Pending</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.summaryVal}>{(stats?.paid_pi ?? 0).toFixed(4)}π</div>
                <div className={styles.summaryLabel}>Paid</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.summaryVal}>{(stats?.total_earned_pi ?? 0).toFixed(4)}π</div>
                <div className={styles.summaryLabel}>Total</div>
              </div>
            </div>

            {earnings.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>💸</div>
                <div className={styles.emptyTitle}>No earnings yet</div>
                <div className={styles.emptySub}>Share your link and start earning!</div>
              </div>
            ) : earnings.map(e => (
              <div key={e.id} className={styles.earningRow}>
                <div className={styles.earningIcon}>{PLATFORMS[e.platform] ?? "💳"}</div>
                <div className={styles.earningInfo}>
                  <div className={styles.earningTitle}>
                    {e.source_user?.username ? `@${e.source_user.username}` : "Bonus"}
                    <span className={styles.earningLevel}>L{e.level}</span>
                  </div>
                  <div className={styles.earningMeta}>{e.platform} · {timeAgo(e.created_at)}</div>
                </div>
                <div className={styles.earningRight}>
                  <div className={styles.earningAmt}>+{Number(e.earned_pi).toFixed(4)}π</div>
                  <div className={`${styles.earningStatus} ${e.status === "paid" ? styles.paid : styles.pending}`}>
                    {e.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── MY TEAM ── */}
        {tab === "team" && (
          <div className={styles.teamList}>
            {referrals.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>👥</div>
                <div className={styles.emptyTitle}>No referrals yet</div>
                <div className={styles.emptySub}>Share your link to build your team!</div>
                <button className={styles.shareBtn2} onClick={handleShare}>🚀 Share Now</button>
              </div>
            ) : referrals.map((r, i) => (
              <div key={r.id} className={styles.teamRow}>
                <div className={styles.teamRank}>#{i + 1}</div>
                <div className={styles.teamAvatar}>
                  {r.referred.avatar_url
                    ? <img src={r.referred.avatar_url} alt="" className={styles.avatarImg} />
                    : getInitial(r.referred.username)
                  }
                </div>
                <div className={styles.teamInfo}>
                  <div className={styles.teamName}>{r.referred.display_name || r.referred.username}</div>
                  <div className={styles.teamMeta}>@{r.referred.username} · Joined {timeAgo(r.created_at)}</div>
                </div>
                <div className={styles.teamBadge}>L1</div>
              </div>
            ))}
          </div>
        )}

        {/* ── LEADERBOARD ── */}
        {tab === "leaderboard" && (
          <div className={styles.leaderboard}>
            <div className={styles.leaderboardTitle}>🏆 Top Earners This Month</div>
            {leaderboard.map((entry, i) => {
              const r = RANKS.find(r => r.key === entry.rank) ?? RANKS[0];
              const isMe = entry.user_id === user?.id;
              return (
                <div key={entry.user_id} className={`${styles.leaderRow} ${isMe ? styles.leaderRowMe : ""}`}>
                  <div className={styles.leaderPos} style={{ color: i < 3 ? "#F5A623" : "var(--color-text-muted)" }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </div>
                  <div className={styles.leaderAvatar}>
                    {entry.users?.avatar_url
                      ? <img src={entry.users.avatar_url} alt="" className={styles.avatarImg} />
                      : getInitial(entry.users?.username ?? "?")
                    }
                  </div>
                  <div className={styles.leaderInfo}>
                    <div className={styles.leaderName}>
                      {entry.users?.display_name || entry.users?.username}
                      {isMe && <span className={styles.meTag}>You</span>}
                    </div>
                    <div className={styles.leaderMeta}>{r.emoji} {r.label} · {entry.total_referrals} referrals</div>
                  </div>
                  <div className={styles.leaderEarned}>{Number(entry.total_earned_pi).toFixed(2)}π</div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}

// ── How It Works Section ───────────────────────────────────────────────
function HowItWorksSection({ config }: { config: Config | null }) {
  return (
    <div className={styles.howItWorks}>

      <div className={styles.howTitle}>How Does It Work?</div>

      <div className={styles.steps}>
        {[
          { step: "01", emoji: "🔗", title: "Get Your Unique Link", desc: "Every pioneer has their own referral link. Copy and share it anywhere." },
          { step: "02", emoji: "📲", title: "Your Friend Joins Supapi", desc: "When your friend clicks your link and registers, they automatically become your downline." },
          { step: "03", emoji: "🛍️", title: "They Spend on Supapi", desc: "Every time they buy items, take courses, or use any platform..." },
          { step: "04", emoji: "💰", title: "You Earn Commission Automatically", desc: "Commission goes into your account automatically. Forever!" },
        ].map(s => (
          <div key={s.step} className={styles.step}>
            <div className={styles.stepNum}>{s.step}</div>
            <div className={styles.stepEmoji}>{s.emoji}</div>
            <div className={styles.stepTitle}>{s.title}</div>
            <div className={styles.stepDesc}>{s.desc}</div>
          </div>
        ))}
      </div>

      <div className={styles.levelExplain}>
        <div className={styles.levelExplainTitle}>3-Level Commission</div>
        <div className={styles.levelTree}>
          <div className={styles.levelTreeRow}>
            <div className={styles.levelTreeYou}>You 👤</div>
          </div>
          <div className={styles.levelTreeLine} />
          <div className={styles.levelTreeRow}>
            <div className={styles.levelTreeNode} style={{ background: "rgba(245,166,35,0.15)", borderColor: "#F5A623" }}>
              <div className={styles.levelTreePct} style={{ color: "#F5A623" }}>{config?.referral_l1_pct ?? 5}%</div>
              <div className={styles.levelTreeLabel}>Your Friend</div>
              <div className={styles.levelTreeSub}>Level 1</div>
            </div>
          </div>
          <div className={styles.levelTreeLine} />
          <div className={styles.levelTreeRow}>
            <div className={styles.levelTreeNode} style={{ background: "rgba(230,126,34,0.1)", borderColor: "#e67e22" }}>
              <div className={styles.levelTreePct} style={{ color: "#e67e22" }}>{config?.referral_l2_pct ?? 2}%</div>
              <div className={styles.levelTreeLabel}>Their Friend</div>
              <div className={styles.levelTreeSub}>Level 2</div>
            </div>
          </div>
          <div className={styles.levelTreeLine} />
          <div className={styles.levelTreeRow}>
            <div className={styles.levelTreeNode} style={{ background: "rgba(211,84,0,0.08)", borderColor: "#d35400" }}>
              <div className={styles.levelTreePct} style={{ color: "#d35400" }}>{config?.referral_l3_pct ?? 1}%</div>
              <div className={styles.levelTreeLabel}>Their Network</div>
              <div className={styles.levelTreeSub}>Level 3</div>
            </div>
          </div>
        </div>
        <div className={styles.levelNote}>
          Commission is calculated from the <b>platform fee</b> — not from the seller's or your friend's pocket.
          Sellers get full price, Supapi pays your commission! 🎉
        </div>
      </div>

      <div className={styles.faq}>
        <div className={styles.faqTitle}>❓ Frequently Asked Questions</div>
        {[
          { q: "Where does the commission come from?", a: "From the platform fee Supapi collects on every transaction. Sellers lose nothing." },
          { q: "How long is commission active?", a: "As long as your friend stays active on Supapi — no time limit!" },
          { q: "When can I withdraw?", a: `Commission has a ${config?.referral_hold_days ?? 30}-day holding period before you can withdraw to your Pi wallet.` },
          { q: "Is there an earning limit?", a: `Yes, max ${config?.referral_monthly_cap ?? 50}π per month to prevent abuse. This will be increased as the platform grows.` },
          { q: "Is this MLM or a scam?", a: "Neither! This is affiliate marketing with depth. No recruitment fee, no capital required. You earn when your friends spend — not when they join." },
        ].map((item, i) => (
          <FaqItem key={i} q={item.q} a={item.a} />
        ))}
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.faqItem}>
      <div className={styles.faqQ} onClick={() => setOpen(o => !o)}>
        <span>{q}</span>
        <span>{open ? "▲" : "▼"}</span>
      </div>
      {open && <div className={styles.faqA}>{a}</div>}
    </div>
  );
}

function EarningsCalculator({ config }: { config: Config | null }) {
  const [friends, setFriends] = useState(5);
  const [spend, setSpend]     = useState(50);
  const platformFee = spend * 0.1;
  const l1 = friends * platformFee * ((config?.referral_l1_pct ?? 5) / 100);
  const l2 = friends * 2 * platformFee * ((config?.referral_l2_pct ?? 2) / 100);
  const l3 = friends * 4 * platformFee * ((config?.referral_l3_pct ?? 1) / 100);
  const total = Math.min(l1 + l2 + l3, config?.referral_monthly_cap ?? 50);

  return (
    <div className={styles.calculator}>
      <div className={styles.calcTitle}>🧮 Calculate Your Earning Potential</div>
      <div className={styles.calcRow}>
        <label className={styles.calcLabel}>Number of direct friends ({friends} people)</label>
        <input type="range" min={1} max={50} value={friends} onChange={e => setFriends(+e.target.value)} className={styles.slider} />
      </div>
      <div className={styles.calcRow}>
        <label className={styles.calcLabel}>Each friend spends ({spend}π per month)</label>
        <input type="range" min={10} max={500} step={10} value={spend} onChange={e => setSpend(+e.target.value)} className={styles.slider} />
      </div>
      <div className={styles.calcResult}>
        <div className={styles.calcBreakdown}>
          <div className={styles.calcLine}><span>L1 ({friends} friends × {spend}π)</span><span style={{ color: "#F5A623" }}>+{l1.toFixed(2)}π</span></div>
          <div className={styles.calcLine}><span>L2 ({friends * 2} people est.)</span><span style={{ color: "#e67e22" }}>+{l2.toFixed(2)}π</span></div>
          <div className={styles.calcLine}><span>L3 ({friends * 4} people est.)</span><span style={{ color: "#d35400" }}>+{l3.toFixed(2)}π</span></div>
        </div>
        <div className={styles.calcTotal}>
          <span>Estimated per month</span>
          <span className={styles.calcTotalVal}>{total.toFixed(2)}π</span>
        </div>
        {total >= (config?.referral_monthly_cap ?? 50) && (
          <div className={styles.calcCap}>🎯 Monthly cap reached — {config?.referral_monthly_cap ?? 50}π</div>
        )}
      </div>
    </div>
  );
}