"use client";
export const dynamic = "force-dynamic";

import { useAuth } from "@/components/providers/AuthProvider";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import PiPriceWidget from "@/components/PiPriceWidget";
import styles from "./page.module.css";

const QUICK_ACTIONS = [
  { href: "/market",   emoji: "🛍️", label: "Market"   },
  { href: "/rewards",  emoji: "🎁", label: "Rewards"  },
  { href: "/referral", emoji: "🤝", label: "Referral" },
  { href: "/wallet",   emoji: "💰", label: "Wallet"   },
];

const PLATFORMS = [
  { href: "/market",      emoji: "🛍️", label: "Marketplace" },
  { href: "/gigs",        emoji: "💼", label: "Gigs"        },
  { href: "/academy",     emoji: "📚", label: "Academy"     },
  { href: "/stay",        emoji: "🏡", label: "Stay"        },
  { href: "/arcade",      emoji: "🎮", label: "Arcade"      },
  { href: "/newsfeed",    emoji: "📰", label: "Newsfeed"    },
  { href: "/wallet",      emoji: "💰", label: "Wallet"      },
  { href: "/referral",    emoji: "🤝", label: "Referral"    },
  { href: "/locator",     emoji: "📍", label: "Locator"     },
  { href: "/jobs",        emoji: "🧑‍💻", label: "Jobs"        },
  { href: "/rewards",     emoji: "🎁", label: "Rewards"     },
  { href: "/reels",       emoji: "🎬", label: "Reels"       },
  { href: "/pi-value",    emoji: "📈", label: "Pi Value"    },
  { href: "/classifieds", emoji: "📋", label: "Classifieds" },
  { href: "/myspace",     emoji: "🪐", label: "MySpace"     },
];

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
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

type VerifyStep = "idle" | "checking" | "done" | "error";

export default function DashboardPage() {
  const { user, isHydrating, login, isLoading } = useAuth();
  const [stats, setStats]               = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [profile, setProfile]           = useState<Profile>(EMPTY_PROFILE);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [activeSection, setActiveSection]   = useState<string | null>(null);
  const [editData, setEditData]         = useState<Partial<Profile>>({});
  const [saving, setSaving]             = useState(false);
  const [saveMsg, setSaveMsg]           = useState("");
  const [verifyStep, setVerifyStep]     = useState<VerifyStep>("idle");
  const [verifyError, setVerifyError]   = useState("");
  const [kycDeclaring, setKycDeclaring] = useState(false);
  const [verifySheet, setVerifySheet]   = useState<"wallet" | "kyc" | null>(null);

  const token = () => typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "";

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

  useEffect(() => {
    if (user) { fetchStats(); fetchProfile(); }
  }, [user, fetchStats, fetchProfile]);

  const openSection = (key: string) => {
    const sec = PROFILE_SECTIONS.find(s => s.key === key);
    if (!sec) return;
    const init: Partial<Profile> = {};
    sec.fields.forEach(f => { (init as any)[f.key] = profile[f.key as keyof Profile] ?? ""; });
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

  const handleKycDeclare = async () => {
    setKycDeclaring(true);
    try {
      const r = await fetch("/api/verify/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ action: "self_declare" }),
      });
      const d = await r.json();
      if (d.success) {
        setProfile(prev => ({ ...prev, kyc_self_declared: true }));
        setVerifySheet(null);
      }
    } catch {}
    setKycDeclaring(false);
  };

  // 1-click wallet verify — uses wallet_address already captured from Pi authenticate()
  const handleWalletVerify = async () => {
    setVerifyStep("checking");
    setVerifyError("");
    try {
      const r = await fetch("/api/verify/wallet/init", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (d.success && (d.verified || d.already)) {
        setVerifyStep("done");
        setProfile(prev => ({ ...prev, wallet_verified: true, wallet_address: d.wallet_address }));
        setTimeout(() => { setVerifySheet(null); setVerifyStep("idle"); }, 2000);
      } else if (d.need_relogin) {
        setVerifyError("Please sign out and sign in again to link your wallet.");
        setVerifyStep("error");
      } else {
        setVerifyError(d.error ?? "Verification failed. Please try again.");
        setVerifyStep("error");
      }
    } catch {
      setVerifyError("Network error. Please try again.");
      setVerifyStep("error");
    }
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

  const isAdmin         = user.role === "admin";
  const pct             = profileComplete();
  const activeSec       = PROFILE_SECTIONS.find(s => s.key === activeSection);
  const hasKyc          = profile.kyc_self_declared || profile.kyc_proof_verified;
  const hasWallet       = profile.wallet_verified;
  const isFullyVerified = hasKyc && hasWallet;

  return (
    <div>
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
            <Link href="/myspace" className={styles.sectionLink}>View public ↗</Link>
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
                {hasKyc && !profile.kyc_proof_verified && <span className={`${styles.badge} ${styles.badgeKyc}`}>🟡 KYC Pioneer</span>}
                {profile.kyc_proof_verified && <span className={`${styles.badge} ${styles.badgeKycProof}`}>🔵 KYC Proof</span>}
                {hasWallet && <span className={`${styles.badge} ${styles.badgeWallet}`}>🟢 Wallet Verified</span>}
                {isFullyVerified && <span className={`${styles.badge} ${styles.badgeVerified}`}>🟣 Verified Pioneer</span>}
                {isAdmin && <span className={`${styles.badge} ${styles.badgeAdmin}`}>⚙️ Admin</span>}
              </div>
            </div>
            <Link href="/myspace" className={styles.profileEdit}>✏️</Link>
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
            const filled = sec.fields.filter(f => profile[f.key as keyof Profile]?.trim()).length;
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

        {/* Pioneer Verification */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Pioneer Verification</div>
            <span className={styles.optionalTag}>Optional</span>
          </div>
          <div className={styles.verifyIntro}>
            Earn trust badges shown on your profile, listings & gigs. Free & takes seconds.
          </div>

          <div className={`${styles.verifyCard} ${hasKyc ? styles.verifyCardDone : ""}`}>
            <div className={styles.verifyCardLeft}>
              <div className={styles.verifyBadgeIcon}>🟡</div>
              <div className={styles.verifyCardInfo}>
                <div className={styles.verifyCardTitle}>KYC Pioneer</div>
                <div className={styles.verifyCardDesc}>Self-declare that you have completed Pi Network KYC. No documents needed.</div>
                {hasKyc && <div className={styles.verifyCardStatus}>✅ Declared</div>}
              </div>
            </div>
            {!hasKyc ? <button className={styles.verifyCardBtn} onClick={() => setVerifySheet("kyc")}>Claim →</button> : <div className={styles.verifyCardCheck}>✓</div>}
          </div>

          <div className={`${styles.verifyCard} ${hasWallet ? styles.verifyCardDone : ""}`}>
            <div className={styles.verifyCardLeft}>
              <div className={styles.verifyBadgeIcon}>🟢</div>
              <div className={styles.verifyCardInfo}>
                <div className={styles.verifyCardTitle}>Wallet Verified</div>
                <div className={styles.verifyCardDesc}>Link your Pi wallet to Supapi. Auto-detected from your Pi login — zero cost.</div>
                {hasWallet && (
                  <div className={styles.verifyCardStatus}>
                    ✅ Linked · <span className={styles.verifyWalletAddr}>{profile.wallet_address ? `${profile.wallet_address.slice(0,8)}...${profile.wallet_address.slice(-6)}` : ""}</span>
                  </div>
                )}
              </div>
            </div>
            {!hasWallet
              ? <button className={styles.verifyCardBtn} onClick={() => { setVerifySheet("wallet"); setVerifyStep("idle"); setVerifyError(""); }}>Verify →</button>
              : <div className={styles.verifyCardCheck}>✓</div>
            }
          </div>

          {isFullyVerified && (
            <div className={styles.verifyAllDone}>
              <span>🟣</span>
              <div>
                <div className={styles.verifyAllDoneTitle}>Verified Pioneer</div>
                <div className={styles.verifyAllDoneSub}>Highest trust level on Supapi!</div>
              </div>
            </div>
          )}
        </div>

        <PiPriceWidget />

        <div className={styles.section}>
          <div className={styles.sectionHeader}><div className={styles.sectionTitle}>Quick Access</div></div>
          <div className={styles.quickGrid}>
            {QUICK_ACTIONS.map((item) => (
              <Link key={item.href} href={item.href} className={styles.quickItem}>
                <span className={styles.quickEmoji}>{item.emoji}</span>
                <span className={styles.quickLabel}>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

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

      {/* KYC Sheet */}
      {verifySheet === "kyc" && (
        <div className={styles.sheetOverlay} onClick={() => setVerifySheet(null)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetHeader}>
              <div><div className={styles.sheetTitle}>🟡 KYC Pioneer</div><div className={styles.sheetDesc}>Self-declaration — no documents required</div></div>
              <button className={styles.sheetClose} onClick={() => setVerifySheet(null)}>✕</button>
            </div>
            <div className={styles.sheetBody}>
              <div className={styles.kycDeclareBox}>
                <div className={styles.kycDeclareIcon}>🪐</div>
                <div className={styles.kycDeclareText}>By claiming this badge, you confirm that you have completed Pi Network KYC verification as a Pioneer. This is based on your honour — no documents are uploaded or stored.</div>
                <div className={styles.kycDeclareNote}>⚠️ False declarations may result in badge removal.</div>
              </div>
              <button className={styles.saveBtn} onClick={handleKycDeclare} disabled={kycDeclaring}>
                {kycDeclaring ? "Claiming..." : "✅ I confirm — Claim KYC Pioneer Badge"}
              </button>
              <button className={styles.cancelBtn} onClick={() => setVerifySheet(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Verify Sheet */}
      {verifySheet === "wallet" && (
        <div className={styles.sheetOverlay} onClick={() => verifyStep !== "checking" && setVerifySheet(null)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetHeader}>
              <div><div className={styles.sheetTitle}>🟢 Wallet Verification</div><div className={styles.sheetDesc}>Link your Pi wallet — free & instant</div></div>
              <button className={styles.sheetClose} onClick={() => setVerifySheet(null)} disabled={verifyStep === "checking"}>✕</button>
            </div>
            <div className={styles.sheetBody}>
              {verifyStep === "idle" && (
                <>
                  <div className={styles.walletVerifySteps}>
                    <div className={styles.walletVerifyStep}><div className={styles.walletVerifyStepNum}>✓</div><div>Your Pi wallet address is automatically captured when you sign in with Pi</div></div>
                    <div className={styles.walletVerifyStep}><div className={styles.walletVerifyStepNum}>✓</div><div>No transaction needed — zero cost, completely free</div></div>
                    <div className={styles.walletVerifyStep}><div className={styles.walletVerifyStepNum}>✓</div><div>Your wallet address will be linked to your Supapi profile</div></div>
                  </div>
                  <div className={styles.walletVerifyNote}>
                    💡 Wallet address is read from Pi SDK during login. No private key or seed phrase is ever accessed.
                  </div>
                  <button className={styles.saveBtn} onClick={handleWalletVerify}>Link My Pi Wallet →</button>
                </>
              )}
              {verifyStep === "checking" && (
                <div className={styles.verifyChecking}>
                  <div className={styles.verifyCheckingSpinner}>⏳</div>
                  <div>Linking your wallet...</div>
                </div>
              )}
              {verifyStep === "done" && (
                <div className={styles.verifyDone}>
                  <div className={styles.verifyDoneIcon}>✅</div>
                  <div className={styles.verifyDoneTitle}>Wallet Linked!</div>
                  <div className={styles.verifyDoneSub}>🟢 Badge added to your profile</div>
                </div>
              )}
              {verifyStep === "error" && (
                <>
                  <div className={styles.verifyError}>{verifyError}</div>
                  <button className={styles.saveBtn} onClick={() => setVerifyStep("idle")}>Try Again</button>
                  <button className={styles.cancelBtn} onClick={() => setVerifySheet(null)}>Cancel</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
                      value={editData[field.key as keyof Profile] ?? ""}
                      onChange={e => setEditData(prev => ({ ...prev, [field.key]: e.target.value }))} />
                  ) : (
                    <input className={styles.formInput} type={field.type} placeholder={field.placeholder}
                      value={editData[field.key as keyof Profile] ?? ""}
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
