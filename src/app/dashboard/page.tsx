"use client";
export const dynamic = "force-dynamic";

import { useAuth } from "@/components/providers/AuthProvider";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import PiPriceWidget from "@/components/PiPriceWidget";
import styles from "./page.module.css";

const QUICK_ACTIONS = [
  { href: "/market",   emoji: "🛍️", label: "Market"   },
  { href: "/wallet",   emoji: "💰", label: "Wallet"   },
  { href: "/referral", emoji: "🤝", label: "Referral" },
  { href: "/rewards",  emoji: "🎁", label: "Rewards"  },
];

const PLATFORMS = [
  { href: "/market",      emoji: "🛍️", label: "Marketplace" },
  { href: "/gigs",        emoji: "💼", label: "Gigs"        },
  { href: "/academy",     emoji: "📚", label: "Academy"     },
  { href: "/stay",        emoji: "🏡", label: "Stay"        },
  { href: "/arcade",      emoji: "🎮", label: "Arcade"      },
  { href: "/newsfeed",   emoji: "📰", label: "Newsfeed"   },
  { href: "/wallet",      emoji: "💰", label: "Wallet"      },
  { href: "/referral",    emoji: "🤝", label: "Referral"    },
  { href: "/locator",     emoji: "📍", label: "Locator"     },
  { href: "/jobs",        emoji: "🧑‍💻", label: "Jobs"        },
  { href: "/rewards",     emoji: "🎁", label: "Rewards"     },
  { href: "/reels",     emoji: "🎬", label: "Reels"     },
  { href: "/pi-value",    emoji: "📈", label: "Pi Value"    },
  { href: "/classifieds", emoji: "📋", label: "Classifieds" },
  { href: "/myspace",     emoji: "🪐", label: "MySpace"     },
];

const TX_ICONS: Record<string, string> = {
  sale: "💰", purchase: "🛍️", referral_reward: "🤝",
  game_reward: "🎮", course_enrollment: "📚", stay_booking: "🏡",
  escrow_release: "🔓", platform_fee: "⚙️",
};
const TX_LABELS: Record<string, string> = {
  sale: "Sale earnings", purchase: "Purchase", referral_reward: "Referral reward",
  game_reward: "Game reward", course_enrollment: "Course enrolled",
  stay_booking: "Stay booking", escrow_release: "Escrow released", platform_fee: "Platform fee",
};

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Stats {
  orders: number; referrals: number; earned: string;
  transactions: Array<{ id: string; type: string; amount_pi: number; memo: string; status: string; created_at: string }>;
}

interface Profile {
  display_name: string; bio: string; phone: string; email: string;
  address_line1: string; address_line2: string; city: string;
  state: string; postcode: string; country: string;
  kyc_status: string; wallet_address: string; avatar_url: string;
}

const EMPTY_PROFILE: Profile = {
  display_name: "", bio: "", phone: "", email: "",
  address_line1: "", address_line2: "", city: "",
  state: "", postcode: "", country: "",
  kyc_status: "", wallet_address: "", avatar_url: "",
};

const PROFILE_SECTIONS = [
  {
    key: "personal", label: "Personal Info", icon: "👤",
    desc: "Used across all Supapi platforms",
    fields: [
      { key: "display_name", label: "Display Name",  type: "text",  placeholder: "Your name" },
      { key: "bio",          label: "Bio",            type: "textarea", placeholder: "Tell the community about yourself..." },
      { key: "phone",        label: "Phone Number",   type: "tel",   placeholder: "+60 1X-XXXXXXX" },
      { key: "email",        label: "Email",          type: "email", placeholder: "your@email.com" },
    ],
  },
  {
    key: "shipping", label: "Shipping Address", icon: "📦",
    desc: "Auto-filled when buying on Marketplace & Stay",
    fields: [
      { key: "address_line1", label: "Address Line 1", type: "text", placeholder: "Street address" },
      { key: "address_line2", label: "Address Line 2", type: "text", placeholder: "Apt, suite, unit (optional)" },
      { key: "city",          label: "City",           type: "text", placeholder: "Kuala Lumpur" },
      { key: "state",         label: "State",          type: "text", placeholder: "Selangor" },
      { key: "postcode",      label: "Postcode",       type: "text", placeholder: "50000" },
      { key: "country",       label: "Country",        type: "text", placeholder: "Malaysia" },
    ],
  },
];

export default function DashboardPage() {
  const { user, isHydrating, login, isLoading } = useAuth();
  const [stats, setStats]           = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [profile, setProfile]       = useState<Profile>(EMPTY_PROFILE);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [editData, setEditData]     = useState<Partial<Profile>>({});
  const [saving, setSaving]         = useState(false);
  const [saveMsg, setSaveMsg]       = useState("");

  const fetchStats = useCallback(async () => {
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    setLoadingStats(true);
    try {
      const r = await fetch("/api/dashboard/stats", { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.success) setStats(d.data);
    } catch {}
    setLoadingStats(false);
  }, []);

  const fetchProfile = useCallback(async () => {
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    setLoadingProfile(true);
    try {
      const r = await fetch("/api/dashboard/profile", { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.success && d.data) setProfile({ ...EMPTY_PROFILE, ...d.data });
    } catch {}
    setLoadingProfile(false);
  }, []);

  useEffect(() => {
    if (user) { fetchStats(); fetchProfile(); }
  }, [user, fetchStats, fetchProfile]);

  const openSection = (key: string) => {
    const sec = PROFILE_SECTIONS.find(s => s.key === key);
    if (!sec) return;
    const init: Partial<Profile> = {};
    sec.fields.forEach(f => { init[f.key as keyof Profile] = profile[f.key as keyof Profile] ?? ""; });
    setEditData(init);
    setActiveSection(key);
    setSaveMsg("");
  };

  const handleSave = async () => {
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const r = await fetch("/api/dashboard/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editData),
      });
      const d = await r.json();
      if (d.success) {
        setProfile(prev => ({ ...prev, ...editData }));
        setSaveMsg("✅ Saved!");
        setTimeout(() => { setActiveSection(null); setSaveMsg(""); }, 1000);
      } else {
        setSaveMsg("❌ Failed to save");
      }
    } catch { setSaveMsg("❌ Error"); }
    setSaving(false);
  };

  const profileComplete = () => {
    const fields = ["display_name","phone","email","address_line1","city","postcode","country"];
    const filled = fields.filter(f => profile[f as keyof Profile]?.trim()).length;
    return Math.round((filled / fields.length) * 100);
  };

  if (isHydrating) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1A1A2E,#0F3460)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Loading...</span>
    </div>
  );

  if (!user) return (
    <div className={styles.guestPage}>
      <div className={styles.guestIcon}>🪐</div>
      <h1 className={styles.guestTitle}>Your Pi Dashboard</h1>
      <p className={styles.guestSub}>Login with your Pi account to access all 15 platforms.</p>
      <button className={styles.guestBtn} onClick={() => login()} disabled={isLoading}>
        {isLoading ? "Connecting..." : "π  Sign in with Pi"}
      </button>
    </div>
  );

  const isAdmin = user.role === "admin";
  const txList  = stats?.transactions ?? [];
  const pct     = profileComplete();
  const activeSec = PROFILE_SECTIONS.find(s => s.key === activeSection);

  return (
    <div>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <div className={styles.greeting}>{getGreeting()},</div>
            <div className={styles.username}><span className={styles.usernamePi}>π</span> {user.username}</div>
          </div>
          <Link href="/myspace" className={styles.avatar}>
            {(profile.avatar_url || user.avatar_url)
              ? <img src={profile.avatar_url || user.avatar_url!} alt={user.username} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              : getInitial(user.username)
            }
          </Link>
        </div>
        <div className={styles.statRow}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{loadingStats ? "..." : `${stats?.earned ?? "0.00"}π`}</div>
            <div className={styles.statLabel}>Supapi Earnings</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{loadingStats ? "..." : (stats?.orders ?? 0)}</div>
            <div className={styles.statLabel}>Orders</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{loadingStats ? "..." : (stats?.referrals ?? 0)}</div>
            <div className={styles.statLabel}>Referrals</div>
          </div>
        </div>
      </div>

      <div className={styles.body}>

        {/* Admin shortcut */}
        {isAdmin && (
          <Link href="/admin/dashboard" className={styles.adminBanner}>
            <div className={styles.adminBannerLeft}>
              <span className={styles.adminBannerIcon}>⚙️</span>
              <div>
                <div className={styles.adminBannerTitle}>Admin Dashboard</div>
                <div className={styles.adminBannerSub}>Manage users, listings & analytics</div>
              </div>
            </div>
            <span className={styles.adminBannerArrow}>→</span>
          </Link>
        )}

        {/* ── Profile Overview ── */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>My Profile</div>
            <Link href="/myspace" className={styles.sectionLink}>View public ↗</Link>
          </div>

          {/* Profile card */}
          <div className={styles.profileCard}>
            <div className={styles.profileAvatar}>
            {(profile.avatar_url || user.avatar_url)
              ? <img src={profile.avatar_url || user.avatar_url!} alt={user.username} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              : getInitial(user.username)
            }
          </div>
            <div className={styles.profileInfo}>
              <div className={styles.profileName}>{profile.display_name || user.display_name || user.username}</div>
              <div className={styles.profilePiId}>@{user.username}</div>
              <div className={styles.profileBadges}>
                <span className={styles.badge}>🪐 Pioneer</span>
                {(profile.kyc_status || user.kyc_status) === "verified" && <span className={styles.badge}>✅ KYC</span>}
                {isAdmin && <span className={`${styles.badge} ${styles.badgeAdmin}`}>⚙️ Admin</span>}
              </div>
            </div>
            <Link href="/myspace" className={styles.profileEdit}>✏️</Link>
          </div>

          {/* Profile completeness */}
          <div className={styles.profileProgress}>
            <div className={styles.profileProgressTop}>
              <span className={styles.profileProgressLabel}>Profile Completeness</span>
              <span className={styles.profileProgressPct} style={{ color: pct === 100 ? "#27ae60" : "var(--color-gold-dark)" }}>
                {pct}%
              </span>
            </div>
            <div className={styles.profileProgressBar}>
              <div className={styles.profileProgressFill} style={{ width: `${pct}%`, background: pct === 100 ? "#27ae60" : "var(--color-gold)" }} />
            </div>
            {pct < 100 && (
              <div className={styles.profileProgressHint}>
                Complete your profile to unlock faster checkout & better trust from buyers
              </div>
            )}
          </div>

          {/* Profile sections */}
          {PROFILE_SECTIONS.map((sec) => {
            const filled = sec.fields.filter(f => profile[f.key as keyof Profile]?.trim()).length;
            const total  = sec.fields.length;
            const done   = filled === total;
            return (
              <div key={sec.key} className={styles.profileSection} onClick={() => openSection(sec.key)}>
                <div className={styles.profileSectionIcon}>{sec.icon}</div>
                <div className={styles.profileSectionInfo}>
                  <div className={styles.profileSectionTitle}>{sec.label}</div>
                  <div className={styles.profileSectionDesc}>{sec.desc}</div>
                  <div className={styles.profileSectionStatus}>
                    {done
                      ? <span className={styles.statusDone}>✅ Complete</span>
                      : <span className={styles.statusPending}>{filled}/{total} fields filled</span>
                    }
                  </div>
                </div>
                <div className={styles.profileSectionArrow}>›</div>
              </div>
            );
          })}
        </div>

        {/* ── Pi Price Widget ── */}
        <PiPriceWidget />

        {/* Quick Actions */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Quick Access</div>
          </div>
          <div className={styles.quickGrid}>
            {QUICK_ACTIONS.map((item) => (
              <Link key={item.href} href={item.href} className={styles.quickItem}>
                <span className={styles.quickEmoji}>{item.emoji}</span>
                <span className={styles.quickLabel}>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Transaction History */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Transaction History</div>
            <Link href="/wallet" className={styles.sectionLink}>See all →</Link>
          </div>
          {loadingStats ? (
            <div className={styles.empty}><div className={styles.emptyIcon}>⏳</div>Loading...</div>
          ) : txList.length > 0 ? (
            <div className={styles.activityList}>
              {txList.map((tx) => {
                const isEarning = ["sale","referral_reward","game_reward","escrow_release"].includes(tx.type);
                return (
                  <div key={tx.id} className={styles.activityItem}>
                    <div className={styles.activityIcon}>{TX_ICONS[tx.type] ?? "💳"}</div>
                    <div className={styles.activityInfo}>
                      <div className={styles.activityTitle}>{tx.memo || TX_LABELS[tx.type] || tx.type}</div>
                      <div className={styles.activitySub}>
                        {timeAgo(tx.created_at)}
                        {tx.status !== "completed" && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: "var(--color-text-muted)", background: "var(--color-bg)", padding: "1px 6px", borderRadius: 6 }}>
                            {tx.status}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`${styles.activityAmount} ${!isEarning ? styles.activityAmountNeg : ""}`}>
                      {isEarning ? "+" : "-"}{Number(tx.amount_pi).toFixed(2)}π
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📋</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No transactions yet</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Your Supapi earnings and purchases will appear here</div>
            </div>
          )}
        </div>

        {/* All Platforms */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>All Platforms</div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>15 services</span>
          </div>
          <div className={styles.platformsGrid}>
            {PLATFORMS.map((item) => (
              <Link key={item.href} href={item.href} className={styles.platformCard}>
                <span className={styles.platformEmoji}>{item.emoji}</span>
                <span className={styles.platformLabel}>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

      </div>

      {/* ── Edit Sheet ── */}
      {activeSection && activeSec && (
        <div className={styles.sheetOverlay} onClick={() => setActiveSection(null)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetHeader}>
              <div>
                <div className={styles.sheetTitle}>{activeSec.icon} {activeSec.label}</div>
                <div className={styles.sheetDesc}>{activeSec.desc}</div>
              </div>
              <button className={styles.sheetClose} onClick={() => setActiveSection(null)}>✕</button>
            </div>

            <div className={styles.sheetBody}>
              {activeSec.fields.map((field) => (
                <div key={field.key} className={styles.formField}>
                  <label className={styles.formLabel}>{field.label}</label>
                  {field.type === "textarea" ? (
                    <textarea
                      className={styles.formInput}
                      placeholder={field.placeholder}
                      rows={3}
                      value={editData[field.key as keyof Profile] ?? ""}
                      onChange={e => setEditData(prev => ({ ...prev, [field.key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      className={styles.formInput}
                      type={field.type}
                      placeholder={field.placeholder}
                      value={editData[field.key as keyof Profile] ?? ""}
                      onChange={e => setEditData(prev => ({ ...prev, [field.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}

              {saveMsg && <div className={styles.saveMsg}>{saveMsg}</div>}

              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}