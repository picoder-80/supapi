"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AdminPageHero from "@/components/admin/AdminPageHero";
import styles from "./page.module.css";

interface Config { key: string; value: string; description: string; }
interface Stats {
  total_referrals: number; total_earnings_pi: number;
  pending_pi: number; paid_pi: number; active_referrers: number;
}
interface TopEarner {
  user_id: string; total_earned_pi: number; total_referrals: number; rank: string;
  users: { username: string; avatar_url: string | null };
}

const RATE_KEYS = [
  { key: "referral_l1_pct",      label: "Level 1 Commission %",     suffix: "%",  min: 0, max: 20,  step: 0.5, desc: "Direct referral commission from platform fee" },
  { key: "referral_l2_pct",      label: "Level 2 Commission %",     suffix: "%",  min: 0, max: 10,  step: 0.5, desc: "Downline L2 commission" },
  { key: "referral_l3_pct",      label: "Level 3 Commission %",     suffix: "%",  min: 0, max: 5,   step: 0.5, desc: "Downline L3 commission" },
  { key: "referral_monthly_cap", label: "Monthly Cap per User",     suffix: "π",  min: 1, max: 500, step: 1,   desc: "Max commission earnable per month" },
  { key: "referral_hold_days",   label: "Commission Hold (days)",   suffix: "d",  min: 0, max: 90,  step: 1,   desc: "Holding period before withdrawal" },
];

async function safeFetch(url: string, token: string) {
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  } catch { return null; }
}

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }

export default function AdminReferralPage() {
  const [configs, setConfigs]   = useState<Record<string, string>>({});
  const [stats, setStats]       = useState<Stats | null>(null);
  const [topEarners, setTopEarners] = useState<TopEarner[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<string | null>(null);
  const [saved, setSaved]       = useState<string | null>(null);
  const [tab, setTab]           = useState<"rates" | "stats" | "earners">("rates");

  const token = () => localStorage.getItem("supapi_admin_token") ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    const [cfgRes, statsRes, earnRes] = await Promise.all([
      safeFetch("/api/admin/referral?type=config", token()),
      safeFetch("/api/admin/referral?type=stats",  token()),
      safeFetch("/api/admin/referral?type=earners", token()),
    ]);
    if (cfgRes?.success) {
      const map: Record<string, string> = {};
      cfgRes.data.forEach((c: Config) => { map[c.key] = c.value; });
      setConfigs(map);
    }
    if (statsRes?.success) setStats(statsRes.data);
    if (earnRes?.success)  setTopEarners(earnRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (key: string, value: string) => {
    setSaving(key);
    try {
      await fetch("/api/admin/referral", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ key, value }),
      });
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } catch {}
    setSaving(null);
  };

  const totalCommissionPct = (parseFloat(configs.referral_l1_pct ?? "5") +
    parseFloat(configs.referral_l2_pct ?? "2") +
    parseFloat(configs.referral_l3_pct ?? "1"));

  return (
    <div className="adminPage">
      <AdminPageHero
        icon="🤝"
        title="Referral Admin"
        subtitle="Manage commission rates & program settings"
        showBadge
      />

      {stats && (
        <div className="adminSection">
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statValue} style={{ color: "#F5A623" }}>{stats.total_referrals.toLocaleString()}</div>
            <div className={styles.statLabel}>Total Referrals</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.active_referrers}</div>
            <div className={styles.statLabel}>Active Referrers</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue} style={{ color: "#f39c12" }}>{Number(stats.pending_pi).toFixed(2)}π</div>
            <div className={styles.statLabel}>Pending Payout</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue} style={{ color: "#27ae60" }}>{Number(stats.total_earnings_pi).toFixed(2)}π</div>
            <div className={styles.statLabel}>Total Earned</div>
          </div>
        </div>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        {[
          { key: "rates",   label: "⚙️ Commission Rates" },
          { key: "stats",   label: "📊 Analytics"        },
          { key: "earners", label: "🏆 Top Earners"      },
        ].map(t => (
          <button key={t.key} className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
            onClick={() => setTab(t.key as any)}>{t.label}</button>
        ))}
      </div>

      {/* ── RATES TAB ── */}
      {tab === "rates" && (
        <div className="adminSection">
          <div className={styles.warningBox}>
            ⚠️ Rate changes will affect <b>all new transactions</b> immediately. Existing transactions are not affected.
          </div>

          <div className={styles.totalPct}>
            Total commission from platform fee:
            <span className={styles.totalPctVal} style={{ color: totalCommissionPct > 15 ? "#e74c3c" : "#27ae60" }}>
              {totalCommissionPct.toFixed(1)}% {totalCommissionPct > 15 ? "⚠️ High" : "✅ Healthy"}
            </span>
          </div>

          {loading ? (
            [...Array(7)].map((_, i) => <div key={i} className={styles.skeleton} />)
          ) : (
            RATE_KEYS.map(cfg => {
              const val = parseFloat(configs[cfg.key] ?? "0");
              const isSaving = saving === cfg.key;
              const isSaved  = saved  === cfg.key;
              return (
                <div key={cfg.key} className={styles.rateCard}>
                  <div className={styles.rateTop}>
                    <div>
                      <div className={styles.rateLabel}>{cfg.label}</div>
                      <div className={styles.rateDesc}>{cfg.desc}</div>
                    </div>
                    <div className={styles.rateValDisplay}>
                      {val}{cfg.suffix}
                    </div>
                  </div>
                  <input
                    type="range"
                    min={cfg.min} max={cfg.max} step={cfg.step}
                    value={val}
                    className={styles.slider}
                    onChange={e => setConfigs(c => ({ ...c, [cfg.key]: e.target.value }))}
                  />
                  <div className={styles.rateFooter}>
                    <div className={styles.rateRange}>{cfg.min}{cfg.suffix} — {cfg.max}{cfg.suffix}</div>
                    <button
                      className={`${styles.saveBtn} ${isSaved ? styles.saveBtnDone : ""}`}
                      disabled={isSaving}
                      onClick={() => handleSave(cfg.key, String(configs[cfg.key] ?? val))}
                    >
                      {isSaving ? "Saving..." : isSaved ? "✅ Saved" : "Save"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── STATS TAB ── */}
      {tab === "stats" && (
        <div className="adminSection">
          <div className={styles.statsDetailGrid}>
            <div className={styles.detailCard}>
              <div className={styles.detailIcon}>💰</div>
              <div className={styles.detailLabel}>Total Earned (All Time)</div>
              <div className={styles.detailVal}>{Number(stats?.total_earnings_pi ?? 0).toFixed(4)}π</div>
            </div>
            <div className={styles.detailCard}>
              <div className={styles.detailIcon}>⏳</div>
              <div className={styles.detailLabel}>Pending Payout</div>
              <div className={styles.detailVal} style={{ color: "#f39c12" }}>{Number(stats?.pending_pi ?? 0).toFixed(4)}π</div>
            </div>
            <div className={styles.detailCard}>
              <div className={styles.detailIcon}>✅</div>
              <div className={styles.detailLabel}>Paid Out</div>
              <div className={styles.detailVal} style={{ color: "#27ae60" }}>{Number(stats?.paid_pi ?? 0).toFixed(4)}π</div>
            </div>
            <div className={styles.detailCard}>
              <div className={styles.detailIcon}>👥</div>
              <div className={styles.detailLabel}>Total Referral Links</div>
              <div className={styles.detailVal}>{stats?.total_referrals ?? 0}</div>
            </div>
          </div>
          <div className={styles.ratePreview}>
            <div className={styles.ratePreviewTitle}>Current Rate Preview</div>
            <div className={styles.ratePreviewDesc}>
              If buyer spends 100π → platform fee 10π:
            </div>
            {[1,2,3].map(l => (
              <div key={l} className={styles.ratePreviewRow}>
                <span>Level {l} referrer earns:</span>
                <span className={styles.ratePreviewVal}>
                  {(10 * parseFloat(configs[`referral_l${l}_pct`] ?? "0") / 100).toFixed(4)}π
                  ({configs[`referral_l${l}_pct`] ?? 0}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TOP EARNERS TAB ── */}
      {tab === "earners" && (
        <div className="adminSection">
          <div className={styles.earnerList}>
            {topEarners.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🏆</div>
                <div className={styles.emptyText}>No earnings yet</div>
              </div>
            ) : topEarners.map((e, i) => (
              <div key={e.user_id} className={styles.earnerRow}>
                <div className={styles.earnerPos}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i+1}`}
                </div>
                <div className={styles.earnerAvatar}>
                  {e.users?.avatar_url
                    ? <img src={e.users.avatar_url} alt="" className={styles.avatarImg} />
                    : getInitial(e.users?.username ?? "?")
                  }
                </div>
                <div className={styles.earnerInfo}>
                  <div className={styles.earnerName}>@{e.users?.username}</div>
                  <div className={styles.earnerMeta}>{e.total_referrals} referrals · {e.rank}</div>
                </div>
                <div className={styles.earnerAmt}>{Number(e.total_earned_pi).toFixed(2)}π</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="adminQuickLinks">
        <Link href="/admin/dashboard" className="adminBackBtn">Back to Dashboard</Link>
      </div>
    </div>
  );
}