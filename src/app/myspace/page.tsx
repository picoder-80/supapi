"use client";
export const dynamic = "force-dynamic";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useOnlineStatus } from "@/components/providers/PresenceProvider";
import styles from "./page.module.css";

const TABS = [
  { id: "overview", label: "Overview", emoji: "🪐" },
  { id: "listings", label: "Market",   emoji: "🛍️" },
  { id: "gigs",     label: "Gigs",     emoji: "💼" },
  { id: "content",  label: "Content",  emoji: "🎬" },
  { id: "reviews",  label: "Reviews",  emoji: "⭐" },
  { id: "badges",   label: "Badges",   emoji: "🏆" },
];

const OVERVIEW_ITEMS = [
  { key: "listings",   href: "/market",      emoji: "🛍️", label: "Marketplace"  },
  { key: "gigs",       href: "/gigs",        emoji: "💼", label: "Gigs"          },
  { key: "courses",    href: "/academy",     emoji: "📚", label: "Courses"       },
  { key: "stays",      href: "/stay",        emoji: "🏡", label: "Properties"    },
  { key: "content",    href: "/content",     emoji: "🎬", label: "Content"       },
  { key: "classifieds",href: "/classifieds", emoji: "📋", label: "Classifieds"   },
  { key: "jobs",       href: "/jobs",        emoji: "🧑‍💻", label: "Jobs"          },
  { key: "locator",    href: "/locator",     emoji: "📍", label: "Locator"       },
  { key: "referral",   href: "/referral",    emoji: "🤝", label: "Referrals"     },
  { key: "community",  href: "/community",   emoji: "👥", label: "Community"     },
  { key: "arcade",     href: "/arcade",      emoji: "🎮", label: "Arcade"        },
  { key: "rewards",    href: "/rewards",     emoji: "🎁", label: "Rewards"       },
];

const ALL_BADGES = [
  { emoji: "🪐", name: "Pioneer",      desc: "First login",             key: "pioneer"  },
  { emoji: "✅", name: "KYC Verified", desc: "Identity verified",       key: "kyc"      },
  { emoji: "🛍️", name: "First Sale",   desc: "Sold first item",         key: "sale"     },
  { emoji: "💼", name: "Gigmaster",    desc: "Complete 10 gigs",        key: "gigs"     },
  { emoji: "📚", name: "Scholar",      desc: "Enroll in a course",      key: "scholar"  },
  { emoji: "🤝", name: "Connector",    desc: "Refer 5 friends",         key: "refer"    },
  { emoji: "🎁", name: "Daily Streak", desc: "7-day check-in streak",   key: "streak"   },
  { emoji: "⭐", name: "Top Rated",    desc: "Avg rating above 4.8",    key: "rated"    },
  { emoji: "💰", name: "Pi Rich",      desc: "Earn 100π total",         key: "rich"     },
  { emoji: "🏆", name: "Legend",       desc: "Complete all challenges", key: "legend"   },
];

function getInitial(name: string) { return name?.charAt(0).toUpperCase() ?? "?"; }
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}

export default function MySpacePage() {
  const { user, isHydrating, login, isLoading } = useAuth();
  const token = typeof window !== "undefined" ? localStorage.getItem("supapi_token") : null;
  const iAmOnline = useOnlineStatus(user?.id ?? null);

  const [activeTab,    setActiveTab]   = useState("overview");
  const [showEdit,     setShowEdit]    = useState(false);
  const [showMsg,      setShowMsg]     = useState(false);
  const [saving,       setSaving]      = useState(false);
  const [displayName,  setDisplayName] = useState("");
  const [bio,          setBio]         = useState("");
  const [avatarUrl,    setAvatarUrl]   = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUrl,      setCoverUrl]      = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [stats,        setStats]       = useState<Record<string, number | string>>({});
  const tabsRef    = useRef<HTMLDivElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);

  // Tabs auto-scroll
  useEffect(() => {
    const c = tabsRef.current;
    if (!c) return;
    const active = c.querySelector("[data-active='true']") as HTMLElement | null;
    if (!active) return;
    const cr = c.getBoundingClientRect(), ar = active.getBoundingClientRect();
    c.scrollTo({ left: c.scrollLeft + (ar.left - cr.left) - cr.width / 2 + ar.width / 2, behavior: "instant" });
  }, [activeTab]);

  // Init from user data
  useEffect(() => {
    if (!user) return;
    setDisplayName(user.display_name ?? user.username);
    setBio((user as any).bio ?? "");
    setAvatarUrl(user.avatar_url ?? null);
    setCoverUrl((user as any).cover_url ?? null);
  }, [user]);

  // Fetch real stats
  const fetchStats = useCallback(async (username: string) => {
    try {
      const r = await fetch(`/api/myspace/stats/${username}`);
      const d = await r.json();
      if (d.success) setStats(d.data);
    } catch {}
  }, []);

  useEffect(() => {
    if (user?.username) fetchStats(user.username);
  }, [user, fetchStats]);

  // Save profile
  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const r = await fetch("/api/myspace/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ display_name: displayName, bio }),
      });
      const d = await r.json();
      if (d.success) setShowEdit(false);
    } catch {}
    setSaving(false);
  };

  // Avatar upload
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append("avatar", file);
      const r = await fetch("/api/myspace/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const d = await r.json();
      if (d.success) setAvatarUrl(d.data.avatar_url);
      else alert(d.error ?? "Upload failed");
    } catch { alert("Upload failed"); }
    setAvatarUploading(false);
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setCoverUploading(true);
    try {
      const form = new FormData();
      form.append("cover", file);
      const r = await fetch("/api/myspace/cover", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const d = await r.json();
      if (d.success) setCoverUrl(d.data.cover_url);
      else alert(d.error ?? "Upload failed");
    } catch { alert("Upload failed"); }
    setCoverUploading(false);
  };

  const handleShare = () => {
    if (!user) return;
    const url = `${window.location.origin}/myspace/${user.username}`;
    if (navigator.share) navigator.share({ title: `${displayName} on Supapi`, url });
    else { navigator.clipboard.writeText(url); alert("Profile link copied!"); }
  };

  if (isHydrating) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1A1A2E,#0F3460)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Loading...</span>
    </div>
  );

  if (!user) return (
    <div className={styles.guestPage}>
      <div className={styles.guestIcon}>🪐</div>
      <h1 className={styles.guestTitle}>Your MySpace</h1>
      <p className={styles.guestSub}>Your personal Pi identity across all 15 platforms.</p>
      <button className={styles.guestBtn} onClick={() => login()} disabled={isLoading}>
        {isLoading ? "Connecting..." : "π Sign in with Pi"}
      </button>
    </div>
  );

  const isKyc = user.kyc_status === "verified";
  const earnedBadges = new Set(["pioneer", ...(isKyc ? ["kyc"] : []), ...((stats.listings as number) > 0 ? ["sale"] : []), ...((stats.gigs as number) >= 10 ? ["gigs"] : []), ...((stats.avg_rating as string) >= "4.8" ? ["rated"] : [])]);

  return (
    <div>
      {/* Cover + Avatar overlap */}
      <div className={styles.coverSection}>
        <div
          className={styles.cover}
          style={coverUrl ? { backgroundImage: `url(${coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          {!coverUrl && (
            <>
              <div className={`${styles.coverOrb} ${styles.coverOrb1}`} />
              <div className={`${styles.coverOrb} ${styles.coverOrb2}`} />
              <div className={`${styles.coverOrb} ${styles.coverOrb3}`} />
            </>
          )}
          <div className={styles.coverActions}>
            <button className={styles.coverEditBtn} onClick={() => coverFileRef.current?.click()} disabled={coverUploading}>
              {coverUploading ? "⏳ Uploading..." : "📷 Change Cover"}
            </button>
            <button className={styles.coverEditBtn} onClick={() => setShowEdit(true)}>✏️ Edit Profile</button>
          </div>
          <input ref={coverFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCoverChange} />
        </div>

        {/* Avatar anchored to bottom of cover, overlapping */}
        <div className={styles.avatarAnchor}>
          <div className={styles.avatarWrapper} onClick={() => fileRef.current?.click()}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className={styles.avatarImg} />
            ) : (
              <div className={styles.avatar}>
                {avatarUploading ? "⏳" : getInitial(displayName)}
              </div>
            )}
            <div className={styles.avatarEditOverlay}>📷</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
        </div>
      </div>

      {/* Profile Header */}
      <div className={styles.profileHeader}>
        <div className={styles.avatarRow}>
          {/* Buttons below avatar */}
          <div className={styles.avatarActions}>
            <button className={styles.messageBtn} onClick={() => setShowMsg(true)}>💬 Message</button>
            <button className={styles.shareBtn} onClick={handleShare}>🔗 Share</button>
          </div>
        </div>

        <div className={styles.nameRow}>
          <div className={styles.displayName}>{displayName}</div>
          <div className={styles.onlineIndicator}>
            <div className={`${styles.onlineDot} ${iAmOnline ? styles.onlineDotActive : styles.onlineDotOffline}`} />
            <span className={`${styles.onlineLabel} ${iAmOnline ? styles.onlineLabelActive : styles.onlineLabelOffline}`}>
              {iAmOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>
        <div className={styles.username}><span className={styles.usernamePi}>π</span> @{user.username}</div>

        {bio ? (
          <div className={styles.bio}>{bio}</div>
        ) : (
          <div className={styles.bioPlaceholder} onClick={() => setShowEdit(true)}>+ Add a bio...</div>
        )}

        <div className={styles.metaRow}>
          <span className={styles.metaItem}><span className={styles.metaIcon}>📅</span> Joined {formatDate(user.created_at)}</span>
          {(user as any).wallet_address && (
            <span className={styles.metaItem}><span className={styles.metaIcon}>💎</span> {((user as any).wallet_address as string).slice(0, 8)}...{((user as any).wallet_address as string).slice(-6)}</span>
          )}
        </div>

        {/* Badges — no admin */}
        <div className={styles.badgesRow}>
          <span className={styles.badge}>🪐 Pioneer</span>
          {isKyc && <span className={`${styles.badge} ${styles.badgeKyc}`}>✅ KYC Verified</span>}
          {user.role === "seller" && <span className={`${styles.badge} ${styles.badgeSeller}`}>🏪 Seller</span>}
          {user.role === "instructor" && <span className={`${styles.badge} ${styles.badgeSeller}`}>👨‍🏫 Instructor</span>}
          {user.role === "host" && <span className={`${styles.badge} ${styles.badgeSeller}`}>🏠 Host</span>}
        </div>

        {/* Stats — real data */}
        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{stats.followers ?? 0}</div>
            <div className={styles.statLabel}>Followers</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{stats.following ?? 0}</div>
            <div className={styles.statLabel}>Following</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{(Number(stats.listings ?? 0) + Number(stats.gigs ?? 0))}</div>
            <div className={styles.statLabel}>Listings</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{stats.avg_rating ?? "5.0"}⭐</div>
            <div className={styles.statLabel}>Rating</div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className={styles.body}>
        <div className={styles.tabs} ref={tabsRef}>
          {TABS.map((tab) => (
            <button key={tab.id} data-active={activeTab === tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(tab.id)}>
              {tab.emoji} {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.tabContent}>

          {activeTab === "overview" && (
            <div>
              <div className={styles.overviewGrid}>
                {OVERVIEW_ITEMS.map((item) => (
                  <Link key={item.href} href={item.href} className={styles.overviewCard}>
                    <div className={styles.overviewCardHeader}>
                      <span className={styles.overviewCardEmoji}>{item.emoji}</span>
                      <span className={styles.overviewCardCount}>{stats[item.key] ?? 0}</span>
                    </div>
                    <div className={styles.overviewCardLabel}>{item.label}</div>
                  </Link>
                ))}
              </div>
              <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 14, padding: 16, marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Your Public Profile</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, fontSize: 13, color: "var(--color-text)", background: "var(--color-bg)", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-border)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    supapi.app/myspace/{user.username}
                  </div>
                  <button onClick={handleShare} style={{ flexShrink: 0, background: "var(--color-gold)", color: "#1A1A2E", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🔗 Share</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "listings" && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🛍️</div>
              <div className={styles.emptyTitle}>{stats.listings ? `${stats.listings} active listings` : "No listings yet"}</div>
              <div className={styles.emptyDesc}>Start selling items on the Marketplace.</div>
              <Link href="/market" className={styles.emptyBtn}>+ Create Listing</Link>
            </div>
          )}

          {activeTab === "gigs" && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>💼</div>
              <div className={styles.emptyTitle}>{stats.gigs ? `${stats.gigs} active gigs` : "No gigs yet"}</div>
              <div className={styles.emptyDesc}>Offer your freelance services and earn Pi.</div>
              <Link href="/gigs" className={styles.emptyBtn}>+ Create Gig</Link>
            </div>
          )}

          {activeTab === "content" && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🎬</div>
              <div className={styles.emptyTitle}>No content yet</div>
              <div className={styles.emptyDesc}>Share your knowledge with the Pi community.</div>
              <Link href="/content" className={styles.emptyBtn}>+ Create Post</Link>
            </div>
          )}

          {activeTab === "reviews" && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>⭐</div>
              <div className={styles.emptyTitle}>{stats.reviews ? `${stats.reviews} reviews` : "No reviews yet"}</div>
              <div className={styles.emptyDesc}>Complete transactions to receive reviews.</div>
            </div>
          )}

          {activeTab === "badges" && (
            <div>
              <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 16 }}>
                {earnedBadges.size} / {ALL_BADGES.length} badges earned
              </div>
              <div className={styles.badgesGrid}>
                {ALL_BADGES.map((badge) => {
                  const earned = earnedBadges.has(badge.key);
                  return (
                    <div key={badge.key} className={`${styles.badgeCard} ${!earned ? styles.badgeCardLocked : ""}`}>
                      <div className={styles.badgeCardEmoji}>{badge.emoji}</div>
                      <div className={styles.badgeCardName}>{badge.name}</div>
                      <div className={styles.badgeCardDesc}>{badge.desc}</div>
                      {!earned && <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 4 }}>🔒 Locked</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEdit && (
        <div className={styles.modalOverlay} onClick={() => setShowEdit(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHandle} />
            <div className={styles.modalTitle}>Edit Profile</div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Display Name</label>
              <input className={styles.formInput} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={user.username} />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Bio</label>
              <textarea className={`${styles.formInput} ${styles.formTextarea}`} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell the Pi community about yourself..." />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setShowEdit(false)}>Cancel</button>
              <button className={styles.modalSave} onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Message Modal */}
      {showMsg && (
        <div className={styles.modalOverlay} onClick={() => setShowMsg(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHandle} />
            <div className={styles.modalTitle}>💬 Messages</div>
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🚀</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>Coming Soon</div>
              <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.6 }}>Direct messaging between Pi users is coming soon!</div>
            </div>
            <button className={styles.modalSave} onClick={() => setShowMsg(false)}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}