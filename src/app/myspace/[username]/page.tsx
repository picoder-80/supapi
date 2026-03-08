"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useOnlineStatus } from "@/components/providers/PresenceProvider";
import styles from "../page.module.css";

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
  { emoji: "🪐", name: "Pioneer",      desc: "First login",             key: "pioneer" },
  { emoji: "✅", name: "KYC Verified", desc: "Identity verified",       key: "kyc"     },
  { emoji: "🛍️", name: "First Sale",   desc: "Sold first item",         key: "sale"    },
  { emoji: "💼", name: "Gigmaster",    desc: "Complete 10 gigs",        key: "gigs"    },
  { emoji: "📚", name: "Scholar",      desc: "Enroll in a course",      key: "scholar" },
  { emoji: "🤝", name: "Connector",    desc: "Refer 5 friends",         key: "refer"   },
  { emoji: "🎁", name: "Daily Streak", desc: "7-day check-in streak",   key: "streak"  },
  { emoji: "⭐", name: "Top Rated",    desc: "Avg rating above 4.8",    key: "rated"   },
  { emoji: "💰", name: "Pi Rich",      desc: "Earn 100π total",         key: "rich"    },
  { emoji: "🏆", name: "Legend",       desc: "Complete all challenges", key: "legend"  },
];

function getInitial(name: string) { return name?.charAt(0).toUpperCase() ?? "?"; }
function formatDate(d: string) { return new Date(d).toLocaleDateString("en-MY", { month: "long", year: "numeric" }); }

export default function PublicProfilePage() {
  const params       = useParams();
  const username     = params.username as string;
  const { user: me } = useAuth();
  const token        = typeof window !== "undefined" ? localStorage.getItem("supapi_token") : null;

  const [profile,    setProfile]   = useState<any>(null);
  const [loading,    setLoading]   = useState(true);
  const [notFound,   setNotFound]  = useState(false);
  const [activeTab,  setActiveTab] = useState("overview");
  const [following,  setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showMsg,    setShowMsg]   = useState(false);
  const [stats,      setStats]     = useState<Record<string, number | string>>({});
  const tabsRef = useRef<HTMLDivElement>(null);

  // Tabs auto-scroll
  useEffect(() => {
    const c = tabsRef.current;
    if (!c) return;
    const active = c.querySelector("[data-active='true']") as HTMLElement | null;
    if (!active) return;
    const cr = c.getBoundingClientRect(), ar = active.getBoundingClientRect();
    c.scrollTo({ left: c.scrollLeft + (ar.left - cr.left) - cr.width / 2 + ar.width / 2, behavior: "instant" });
  }, [activeTab]);

  // Fetch profile
  useEffect(() => {
    fetch(`/api/users/${username}`)
      .then(r => r.json())
      .then(d => { if (d.success) setProfile(d.data.user); else setNotFound(true); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [username]);

  // Fetch stats
  useEffect(() => {
    fetch(`/api/myspace/stats/${username}`)
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d.data); })
      .catch(() => {});
  }, [username]);

  const isOwnProfile   = me?.username === username;
  const isOnline        = useOnlineStatus(profile?.id ?? null);

  const handleFollow = async () => {
    if (!token || !me) return;
    setFollowLoading(true);
    try {
      const method = following ? "DELETE" : "POST";
      const r = await fetch("/api/myspace/follow", {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username }),
      });
      const d = await r.json();
      if (d.success) {
        setFollowing(d.data.following);
        // Update follower count
        setStats(prev => ({
          ...prev,
          followers: Number(prev.followers ?? 0) + (d.data.following ? 1 : -1)
        }));
      }
    } catch {}
    setFollowLoading(false);
  };

  const handleShare = () => {
    if (navigator.share) navigator.share({ title: `${username} on Supapi`, url: window.location.href });
    else { navigator.clipboard.writeText(window.location.href); alert("Profile link copied!"); }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1A1A2E,#0F3460)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Loading profile...</span>
    </div>
  );

  if (notFound) return (
    <div className={styles.guestPage}>
      <div className={styles.guestIcon}>🔍</div>
      <h1 className={styles.guestTitle}>Profile not found</h1>
      <p className={styles.guestSub}>@{username} does not exist on Supapi yet.</p>
      <Link href="/" className={styles.emptyBtn}>Back to Home</Link>
    </div>
  );

  const name   = profile?.display_name || profile?.username || username;
  const isKyc  = profile?.kyc_status === "verified";
  const earnedBadges = new Set(["pioneer", ...(isKyc ? ["kyc"] : []), ...((stats.listings as number) > 0 ? ["sale"] : [])]);

  return (
    <div>
      {/* Cover + Avatar overlap */}
      <div className={styles.coverSection}>
        <div
          className={styles.cover}
          style={profile?.cover_url ? { backgroundImage: `url(${profile.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          {!profile?.cover_url && (
            <>
              <div className={`${styles.coverOrb} ${styles.coverOrb1}`} />
              <div className={`${styles.coverOrb} ${styles.coverOrb2}`} />
              <div className={`${styles.coverOrb} ${styles.coverOrb3}`} />
            </>
          )}
          {isOwnProfile && (
            <div className={styles.coverActions}>
              <Link href="/myspace" className={styles.coverEditBtn}>✏️ Edit Profile</Link>
            </div>
          )}
        </div>

        {/* Avatar anchored to bottom of cover */}
        <div className={styles.avatarAnchor}>
          <div className={styles.avatarWrapper} style={{ cursor: "default" }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={name} className={styles.avatarImg} />
            ) : (
              <div className={styles.avatar}>{getInitial(name)}</div>
            )}

          </div>
        </div>
      </div>

      {/* Profile Header */}
      <div className={styles.profileHeader}>
        <div className={styles.avatarRow}>
          {/* Buttons below avatar space */}
          <div className={styles.avatarActions}>
            {!isOwnProfile && (
              <button
                className={`${styles.followBtn} ${following ? styles.followingBtn : ""}`}
                onClick={handleFollow}
                disabled={followLoading || !me}
              >
                {followLoading ? "..." : following ? "Following ✓" : "+ Follow"}
              </button>
            )}
            <button className={styles.messageBtn} onClick={() => setShowMsg(true)}>💬 Message</button>
            <button className={styles.shareBtn} onClick={handleShare}>🔗 Share</button>
          </div>
        </div>

        <div className={styles.nameRow}>
          <div className={styles.displayName}>{name}</div>
          <div className={styles.onlineIndicator}>
            <div className={`${styles.onlineDot} ${isOnline ? styles.onlineDotActive : styles.onlineDotOffline}`} />
            <span className={`${styles.onlineLabel} ${isOnline ? styles.onlineLabelActive : styles.onlineLabelOffline}`}>
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>
        <div className={styles.username}><span className={styles.usernamePi}>π</span> @{username}</div>

        {profile?.bio && <div className={styles.bio}>{profile.bio}</div>}

        <div className={styles.metaRow}>
          {profile?.created_at && (
            <span className={styles.metaItem}><span className={styles.metaIcon}>📅</span> Joined {formatDate(profile.created_at)}</span>
          )}
          <span className={styles.metaItem}><span className={styles.metaIcon}>📍</span> Pi Network</span>
        </div>

        {/* Badges — never show admin */}
        <div className={styles.badgesRow}>
          <span className={styles.badge}>🪐 Pioneer</span>
          {isKyc && <span className={`${styles.badge} ${styles.badgeKyc}`}>✅ KYC Verified</span>}
          {profile?.role === "seller" && <span className={`${styles.badge} ${styles.badgeSeller}`}>🏪 Seller</span>}
          {profile?.role === "instructor" && <span className={`${styles.badge} ${styles.badgeSeller}`}>👨‍🏫 Instructor</span>}
          {profile?.role === "host" && <span className={`${styles.badge} ${styles.badgeSeller}`}>🏠 Host</span>}
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
            <div className={styles.overviewGrid}>
              {OVERVIEW_ITEMS.map((item) => (
                <div key={item.href} className={styles.overviewCard}>
                  <div className={styles.overviewCardHeader}>
                    <span className={styles.overviewCardEmoji}>{item.emoji}</span>
                    <span className={styles.overviewCardCount}>{stats[item.key] ?? 0}</span>
                  </div>
                  <div className={styles.overviewCardLabel}>{item.label}</div>
                </div>
              ))}
            </div>
          )}
          {activeTab === "listings" && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🛍️</div>
              <div className={styles.emptyTitle}>{stats.listings ? `${stats.listings} active listings` : "No listings yet"}</div>
              <div className={styles.emptyDesc}>@{username} has not listed anything for sale yet.</div>
            </div>
          )}
          {activeTab === "gigs" && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>💼</div>
              <div className={styles.emptyTitle}>{stats.gigs ? `${stats.gigs} active gigs` : "No gigs yet"}</div>
              <div className={styles.emptyDesc}>@{username} has not offered any services yet.</div>
            </div>
          )}
          {activeTab === "content" && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🎬</div>
              <div className={styles.emptyTitle}>No content yet</div>
              <div className={styles.emptyDesc}>@{username} has not posted any content yet.</div>
            </div>
          )}
          {activeTab === "reviews" && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>⭐</div>
              <div className={styles.emptyTitle}>{stats.reviews ? `${stats.reviews} reviews` : "No reviews yet"}</div>
              <div className={styles.emptyDesc}>@{username} has not received any reviews yet.</div>
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

      {/* Message Modal */}
      {showMsg && (
        <div className={styles.modalOverlay} onClick={() => setShowMsg(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHandle} />
            <div className={styles.modalTitle}>💬 Message @{username}</div>
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