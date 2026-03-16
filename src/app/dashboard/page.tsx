"use client";
export const dynamic = "force-dynamic";

import { useAuth } from "@/components/providers/AuthProvider";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { isAdminRole } from "@/lib/admin/roles";
import styles from "./page.module.css";

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

interface Stats {
  orders: number;
  referrals: number;
  earned: string;
  sc_balance?: number;
  listings?: number;
  gigs?: number;
  pets?: number;
  transactions: Array<{ id: string; type: string; amount_pi: number; memo: string; status: string; created_at: string }>;
  recent_orders?: Array<{ id: string; status: string; amount_pi: number; created_at: string; listing?: { title: string } }>;
  credit_transactions?: Array<{ id: string; type: string; amount: number; activity?: string; note?: string; created_at: string }>;
}

interface Profile {
  display_name: string; bio: string; phone: string; email: string;
  address_line1: string; address_line2: string; city: string;
  state: string; postcode: string; country: string;
  kyc_status: string; wallet_address: string; avatar_url: string;
  wallet_verified?: boolean;
  kyc_self_declared?: boolean;
  kyc_proof_verified?: boolean;
}

const EMPTY_PROFILE: Profile = {
  display_name: "", bio: "", phone: "", email: "",
  address_line1: "", address_line2: "", city: "",
  state: "", postcode: "", country: "",
  kyc_status: "", wallet_address: "", avatar_url: "",
  wallet_verified: false,
  kyc_self_declared: false,
  kyc_proof_verified: false,
};

const PROFILE_SECTIONS = [
  {
    key: "personal", label: "Personal Info", icon: "👤",
    desc: "Used across all Supapi platforms",
    fields: [
      { key: "display_name", label: "Display Name",  type: "text",     placeholder: "Your name" },
      { key: "bio",          label: "Bio",            type: "textarea", placeholder: "Tell the community about yourself..." },
      { key: "phone",        label: "Phone Number",   type: "tel",      placeholder: "+60 1X-XXXXXXX" },
      { key: "email",        label: "Email",          type: "email",    placeholder: "your@email.com" },
    ],
  },
  {
    key: "shipping", label: "Shipping Address", icon: "📦",
    desc: "Auto-filled when buying on SupaMarket & SupaStay",
    fields: [
      { key: "address_line1", label: "Address Line 1", type: "text", placeholder: "Street address" },
      { key: "address_line2", label: "Address Line 2", type: "text", placeholder: "Apt, suite, unit (optional)" },
      { key: "city",          label: "City",           type: "text", placeholder: "Los Angeles" },
      { key: "state",         label: "State",          type: "text", placeholder: "California" },
      { key: "postcode",      label: "Postcode",       type: "text", placeholder: "10001" },
      { key: "country",       label: "Country",        type: "text", placeholder: "United States" },
    ],
  },
];

export default function DashboardPage() {
  const { user, isHydrating, login, isLoading } = useAuth();
  const [stats, setStats]               = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [profile, setProfile]           = useState<Profile>(EMPTY_PROFILE);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [activeSection, setActiveSection]   = useState<string | null>(null);
  const [editData, setEditData]         = useState<Record<string, string>>({});
  const [saving, setSaving]             = useState(false);
  const [saveMsg, setSaveMsg]           = useState("");
  const [ordersPage, setOrdersPage]     = useState(1);
  const [activityPage, setActivityPage] = useState(1);

  const token = () => typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "";
  const PAGE_SIZE = 5;
  const recentOrders = stats?.recent_orders ?? [];
  const creditTxs = stats?.credit_transactions ?? [];
  const ordersTotalPages = Math.max(1, Math.ceil(recentOrders.length / PAGE_SIZE));
  const activityTotalPages = Math.max(1, Math.ceil(creditTxs.length / PAGE_SIZE));
  const ordersPageSafe = Math.min(ordersPage, ordersTotalPages);
  const activityPageSafe = Math.min(activityPage, activityTotalPages);
  const ordersPageItems = recentOrders.slice((ordersPageSafe - 1) * PAGE_SIZE, ordersPageSafe * PAGE_SIZE);
  const activityPageItems = creditTxs.slice((activityPageSafe - 1) * PAGE_SIZE, activityPageSafe * PAGE_SIZE);

  const fetchStats = useCallback(async () => {
    if (!token()) return;
    setLoadingStats(true);
    try {
      const r = await fetch("/api/dashboard/stats", { headers: { Authorization: `Bearer ${token()}` } });
      const d = await r.json();
      if (d.success) setStats(d.data);
    } catch {}
    setLoadingStats(false);
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!token()) return;
    setLoadingProfile(true);
    try {
      const r = await fetch("/api/dashboard/profile", { headers: { Authorization: `Bearer ${token()}` } });
      const d = await r.json();
      if (d.success && d.data) setProfile({ ...EMPTY_PROFILE, ...d.data });
    } catch {}
    setLoadingProfile(false);
  }, []);

  const refreshAll = useCallback(() => {
    fetchStats();
    fetchProfile();
  }, [fetchStats, fetchProfile]);

  useEffect(() => {
    if (user) { fetchStats(); fetchProfile(); }
  }, [user, fetchStats, fetchProfile]);

  const openSection = (key: string) => {
    const sec = PROFILE_SECTIONS.find(s => s.key === key);
    if (!sec) return;
    const init: Record<string, string> = {};
    sec.fields.forEach(f => { init[f.key] = String(profile[f.key as keyof Profile] ?? ""); });
    setEditData(init);
    setActiveSection(key);
    setSaveMsg("");
  };

  const handleSave = async () => {
    if (!token()) return;
    setSaving(true); setSaveMsg("");
    try {
      const r = await fetch("/api/dashboard/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(editData),
      });
      const d = await r.json();
      if (d.success) {
        setProfile(prev => ({ ...prev, ...editData }));
        setSaveMsg("✅ Saved!");
        setTimeout(() => { setActiveSection(null); setSaveMsg(""); }, 1000);
      } else { setSaveMsg("❌ Failed to save"); }
    } catch { setSaveMsg("❌ Error"); }
    setSaving(false);
  };

  const profileComplete = () => {
    const fields = ["display_name","phone","email","address_line1","city","postcode","country"];
    const filled = fields.filter(f => String(profile[f as keyof Profile] ?? "").trim()).length;
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

  const isAdmin   = isAdminRole(user.role);
  const pct       = profileComplete();
  const activeSec = PROFILE_SECTIONS.find(s => s.key === activeSection);

  return (
    <div>
      <div className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <div className={styles.greeting}>{getGreeting()},</div>
            <div className={styles.username}><span className={styles.usernamePi}>π</span> {user.username}</div>
          </div>
          <Link href="/supaspace" className={styles.avatar}>
            {(profile.avatar_url || user.avatar_url)
              ? <img src={profile.avatar_url || user.avatar_url!} alt={user.username} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              : getInitial(user.username)
            }
          </Link>
        </div>
        <div className={styles.statRow}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{loadingStats ? "..." : `${stats?.earned ?? "0.00"}π`}</div>
            <div className={styles.statLabel}>Earnings</div>
          </div>
          <Link href="/wallet" className={styles.statCard}>
            <div className={styles.statValue}>{loadingStats ? "..." : `${stats?.sc_balance ?? 0}`}</div>
            <div className={styles.statLabel}>SC Balance</div>
          </Link>
          <Link href="/supamarket/orders" className={styles.statCard}>
            <div className={styles.statValue}>{loadingStats ? "..." : (stats?.orders ?? 0)}</div>
            <div className={styles.statLabel}>Orders</div>
          </Link>
          <Link href="/referral" className={styles.statCard}>
            <div className={styles.statValue}>{loadingStats ? "..." : (stats?.referrals ?? 0)}</div>
            <div className={styles.statLabel}>Referrals</div>
          </Link>
          <Link href="/supapets" className={styles.statCard}>
            <div className={styles.statValue}>{loadingStats ? "..." : (stats?.pets ?? 0)}</div>
            <div className={styles.statLabel}>Pets</div>
          </Link>
        </div>
        <button type="button" className={styles.refreshBtn} onClick={refreshAll} disabled={loadingStats} aria-label="Refresh">
          {loadingStats ? "⏳" : "↻"} Refresh
        </button>
      </div>

      <div className={styles.body}>

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

        {/* Profile */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>My Profile</div>
            <Link href="/supaspace" className={styles.sectionLink}>View public ↗</Link>
          </div>
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
                {isAdmin && <span className={`${styles.badge} ${styles.badgeAdmin}`}>⚙️ Admin</span>}
              </div>
            </div>
            <Link href="/supaspace" className={styles.profileEdit}>✏️</Link>
          </div>

          <div className={styles.profileProgress}>
            <div className={styles.profileProgressTop}>
              <span className={styles.profileProgressLabel}>Profile Completeness</span>
              <span className={styles.profileProgressPct} style={{ color: pct === 100 ? "#27ae60" : "var(--color-gold-dark)" }}>{pct}%</span>
            </div>
            <div className={styles.profileProgressBar}>
              <div className={styles.profileProgressFill} style={{ width: `${pct}%`, background: pct === 100 ? "#27ae60" : "var(--color-gold)" }} />
            </div>
            {pct < 100 && <div className={styles.profileProgressHint}>Complete your profile to unlock faster checkout & better trust from buyers</div>}
          </div>

          {PROFILE_SECTIONS.map((sec) => {
            const filled = sec.fields.filter(f => String(profile[f.key as keyof Profile] ?? "").trim()).length;
            const done   = filled === sec.fields.length;
            return (
              <div key={sec.key} className={styles.profileSection} onClick={() => openSection(sec.key)}>
                <div className={styles.profileSectionIcon}>{sec.icon}</div>
                <div className={styles.profileSectionInfo}>
                  <div className={styles.profileSectionTitle}>{sec.label}</div>
                  <div className={styles.profileSectionDesc}>{sec.desc}</div>
                  <div className={styles.profileSectionStatus}>
                    {done ? <span className={styles.statusDone}>✅ Complete</span> : <span className={styles.statusPending}>{filled}/{sec.fields.length} fields filled</span>}
                  </div>
                </div>
                <div className={styles.profileSectionArrow}>›</div>
              </div>
            );
          })}
        </div>

        {/* What's Next — incomplete profile tips */}
        {pct < 100 && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}><div className={styles.sectionTitle}>What&apos;s Next</div></div>
            <div className={styles.whatsNextCard}>
              <div className={styles.whatsNextIcon}>🎯</div>
              <div className={styles.whatsNextText}>
                Complete your profile ({pct}%) to unlock faster checkout & earn 10 SC bonus.
              </div>
              <button type="button" className={styles.whatsNextBtn} onClick={() => openSection("personal")}>
                Complete Profile →
              </button>
            </div>
          </div>
        )}

        {/* Recent Orders — 5 per page */}
        {recentOrders.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>Recent Orders</div>
              <Link href="/supamarket/orders" className={styles.sectionLink}>View all →</Link>
            </div>
            <div className={styles.activityList}>
              {ordersPageItems.map((o) => (
                <Link key={o.id} href={`/supamarket/orders/${o.id}`} className={styles.activityItem}>
                  <div className={styles.activityIcon}>📦</div>
                  <div className={styles.activityInfo}>
                    <div className={styles.activityTitle}>{o.listing?.title ?? "Order"}</div>
                    <div className={styles.activitySub}>{o.status} · {Number(o.amount_pi).toFixed(2)}π</div>
                  </div>
                  <span className={styles.activityArrow}>›</span>
                </Link>
              ))}
            </div>
            {ordersTotalPages > 1 && (
              <div className={styles.pager}>
                <button type="button" className={styles.pagerBtn} disabled={ordersPageSafe === 1} onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}>← Prev</button>
                <span className={styles.pagerInfo}>Page {ordersPageSafe} of {ordersTotalPages}</span>
                <button type="button" className={styles.pagerBtn} disabled={ordersPageSafe === ordersTotalPages} onClick={() => setOrdersPage((p) => Math.min(ordersTotalPages, p + 1))}>Next →</button>
              </div>
            )}
          </div>
        )}

        {/* Recent Activity (SC) — 5 per page */}
        {creditTxs.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>Recent Activity</div>
              <Link href="/rewards" className={styles.sectionLink}>View all →</Link>
            </div>
            <div className={styles.activityList}>
              {activityPageItems.map((tx) => (
                <div key={tx.id} className={styles.activityItem}>
                  <div className={styles.activityIcon}>{tx.amount >= 0 ? "💎" : "↗"}</div>
                  <div className={styles.activityInfo}>
                    <div className={styles.activityTitle}>{tx.note ?? tx.activity ?? (tx.amount >= 0 ? "Earned" : "Spent")}</div>
                    <div className={styles.activitySub}>{new Date(tx.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className={`${styles.activityAmount} ${tx.amount < 0 ? styles.activityAmountNeg : ""}`}>
                    {tx.amount >= 0 ? "+" : ""}{tx.amount} SC
                  </span>
                </div>
              ))}
            </div>
            {activityTotalPages > 1 && (
              <div className={styles.pager}>
                <button type="button" className={styles.pagerBtn} disabled={activityPageSafe === 1} onClick={() => setActivityPage((p) => Math.max(1, p - 1))}>← Prev</button>
                <span className={styles.pagerInfo}>Page {activityPageSafe} of {activityTotalPages}</span>
                <button type="button" className={styles.pagerBtn} disabled={activityPageSafe === activityTotalPages} onClick={() => setActivityPage((p) => Math.min(activityTotalPages, p + 1))}>Next →</button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Profile Edit Sheet */}
      {activeSection && activeSec && (
        <div className={styles.sheetOverlay} onClick={() => setActiveSection(null)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetHeader}>
              <div><div className={styles.sheetTitle}>{activeSec.icon} {activeSec.label}</div><div className={styles.sheetDesc}>{activeSec.desc}</div></div>
              <button className={styles.sheetClose} onClick={() => setActiveSection(null)}>✕</button>
            </div>
            <div className={styles.sheetBody}>
              {activeSec.fields.map((field) => (
                <div key={field.key} className={styles.formField}>
                  <label className={styles.formLabel}>{field.label}</label>
                  {field.type === "textarea" ? (
                    <textarea className={styles.formInput} placeholder={field.placeholder} rows={3}
                      value={editData[field.key] ?? ""}
                      onChange={e => setEditData(prev => ({ ...prev, [field.key]: e.target.value }))} />
                  ) : (
                    <input className={styles.formInput} type={field.type} placeholder={field.placeholder}
                      value={editData[field.key] ?? ""}
                      onChange={e => setEditData(prev => ({ ...prev, [field.key]: e.target.value }))} />
                  )}
                </div>
              ))}
              {saveMsg && <div className={styles.saveMsg}>{saveMsg}</div>}
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
