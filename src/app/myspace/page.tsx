"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./page.module.css";

const TABS = [
  { id: "overview",  label: "Overview", emoji: "🪐" },
  { id: "listings",  label: "Market",   emoji: "🛍️" },
  { id: "gigs",      label: "Gigs",     emoji: "💼" },
  { id: "content",   label: "Content",  emoji: "🎬" },
  { id: "reviews",   label: "Reviews",  emoji: "⭐" },
  { id: "badges",    label: "Badges",   emoji: "🏆" },
];

const ALL_BADGES = [
  { emoji: "🪐", name: "Pioneer",      desc: "First login",             earned: true  },
  { emoji: "🛍️", name: "First Sale",   desc: "Sold first item",         earned: false },
  { emoji: "💼", name: "Gigmaster",    desc: "Complete 10 gigs",        earned: false },
  { emoji: "📚", name: "Scholar",      desc: "Enroll in a course",      earned: false },
  { emoji: "🤝", name: "Connector",    desc: "Refer 5 friends",         earned: false },
  { emoji: "🎁", name: "Daily Streak", desc: "7-day check-in streak",   earned: false },
  { emoji: "⭐", name: "Top Rated",    desc: "Avg rating above 4.8",    earned: false },
  { emoji: "💰", name: "Pi Rich",      desc: "Earn 100π total",         earned: false },
  { emoji: "🏆", name: "Legend",       desc: "Complete all challenges", earned: false },
];

function getInitial(name: string) {
  return name?.charAt(0).toUpperCase() ?? "?";
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}

export default function MySpacePage() {
  const { user, isHydrating, login, isLoading } = useAuth();
  const [activeTab,   setActiveTab]   = useState("overview");
  const [showEdit,    setShowEdit]    = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio,         setBio]         = useState("");

  if (isHydrating) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1A1A2E,#0F3460)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Loading...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.guestPage}>
        <div className={styles.guestIcon}>🪐</div>
        <h1 className={styles.guestTitle}>Your MySpace</h1>
        <p className={styles.guestSub}>Your personal Pi identity across all 15 platforms. Login to view and customize your profile.</p>
        <button className={styles.guestBtn} onClick={() => login()} disabled={isLoading}>
          {isLoading ? "Connecting..." : "π Sign in with Pi"}
        </button>
      </div>
    );
  }

  const name = displayName || user.display_name || user.username;
  const isAdmin = user.role === "admin";

  const handleShare = () => {
    const url = `${window.location.origin}/myspace/${user.username}`;
    if (navigator.share) {
      navigator.share({ title: `${name} on Supapi`, url });
    } else {
      navigator.clipboard.writeText(url);
      alert("Profile link copied!");
    }
  };

  return (
    <div>
      {/* Cover */}
      <div className={styles.cover}>
        <div className={`${styles.coverOrb} ${styles.coverOrb1}`} />
        <div className={`${styles.coverOrb} ${styles.coverOrb2}`} />
        <div className={`${styles.coverOrb} ${styles.coverOrb3}`} />
        <button className={styles.coverEditBtn} onClick={() => setShowEdit(true)}>
          Edit Profile
        </button>
      </div>

      {/* Profile Header */}
      <div className={styles.profileHeader}>
        <div className={styles.avatarRow}>
          <div className={styles.avatar}>
            {getInitial(name)}
            <div className={styles.avatarOnline} />
          </div>
          <div className={styles.avatarActions}>
            <button className={styles.messageBtn}>Message</button>
            <button className={styles.shareBtn} onClick={handleShare}>Share</button>
          </div>
        </div>

        <div className={styles.displayName}>{name}</div>
        <div className={styles.username}>
          <span className={styles.usernamePi}>π</span> @{user.username}
        </div>

        {bio ? (
          <div className={styles.bio}>{bio}</div>
        ) : (
          <div className={styles.bioPlaceholder} onClick={() => setShowEdit(true)}>
            + Add a bio...
          </div>
        )}

        <div className={styles.metaRow}>
          <span className={styles.metaItem}>
            <span className={styles.metaIcon}>📅</span>
            Joined {formatDate(user.created_at)}
          </span>
          <span className={styles.metaItem}>
            <span className={styles.metaIcon}>📍</span>
            Pi Network
          </span>
        </div>

        <div className={styles.badgesRow}>
          <span className={styles.badge}>🪐 Pioneer</span>
          {user.kyc_status === "verified" && (
            <span className={`${styles.badge} ${styles.badgeKyc}`}>KYC Verified</span>
          )}
          {isAdmin && (
            <span className={`${styles.badge} ${styles.badgeAdmin}`}>Admin</span>
          )}
          {user.role === "seller" && (
            <span className={`${styles.badge} ${styles.badgeSeller}`}>Seller</span>
          )}
        </div>

        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <div className={styles.statValue}>0π</div>
            <div className={styles.statLabel}>Earned</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>0</div>
            <div className={styles.statLabel}>Followers</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>0</div>
            <div className={styles.statLabel}>Following</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>5.0</div>
            <div className={styles.statLabel}>Rating</div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className={styles.body}>
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.emoji} {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.tabContent}>

          {activeTab === "overview" && (
            <div>
              <div className={styles.overviewGrid}>
                {[
                  { href: "/market",      emoji: "🛍️", label: "Marketplace", count: 0 },
                  { href: "/gigs",        emoji: "💼", label: "Gigs",        count: 0 },
                  { href: "/academy",     emoji: "📚", label: "Courses",     count: 0 },
                  { href: "/stay",        emoji: "🏡", label: "Properties",  count: 0 },
                  { href: "/content",     emoji: "🎬", label: "Content",     count: 0 },
                  { href: "/classifieds", emoji: "📋", label: "Classifieds", count: 0 },
                ].map((item) => (
                  <Link key={item.href} href={item.href} className={styles.overviewCard}>
                    <div className={styles.overviewCardHeader}>
                      <span className={styles.overviewCardEmoji}>{item.emoji}</span>
                      <span className={styles.overviewCardCount}>{item.count}</span>
                    </div>
                    <div className={styles.overviewCardLabel}>{item.label}</div>
                  </Link>
                ))}
              </div>
              <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 14, padding: 16, marginTop: 8 }}>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Your Public Profile
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, fontSize: 13, color: "var(--color-text)", background: "var(--color-bg)", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-border)" }}>
                    supapi.app/myspace/{user.username}
                  </div>
                  <button onClick={handleShare} style={{ background: "var(--color-gold)", color: "#1A1A2E", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    Share
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "listings" && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🛍️</div>
              <div className={styles.emptyTitle}>No listings yet</div>
              <div className={styles.emptyDesc}>Start selling items on the Marketplace and they will appear here.</div>
              <Link href="/market" className={styles.emptyBtn}>Create Listing</Link>
            </div>
          )}

          {activeTab === "gigs" && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>💼</div>
              <div className={styles.emptyTitle}>No gigs yet</div>
              <div className={styles.emptyDesc}>Offer your freelance services and earn Pi.</div>
              <Link href="/gigs" className={styles.emptyBtn}>Create Gig</Link>
            </div>
          )}

          {activeTab === "content" && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🎬</div>
              <div className={styles.emptyTitle}>No content yet</div>
              <div className={styles.emptyDesc}>Share your knowledge and creativity with the Pi community.</div>
              <Link href="/content" className={styles.emptyBtn}>Create Post</Link>
            </div>
          )}

          {activeTab === "reviews" && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>⭐</div>
              <div className={styles.emptyTitle}>No reviews yet</div>
              <div className={styles.emptyDesc}>Complete transactions to start receiving reviews from the community.</div>
            </div>
          )}

          {activeTab === "badges" && (
            <div>
              <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 16 }}>
                {ALL_BADGES.filter(b => b.earned).length} / {ALL_BADGES.length} badges earned
              </div>
              <div className={styles.badgesGrid}>
                {ALL_BADGES.map((badge) => (
                  <div
                    key={badge.name}
                    className={`${styles.badgeCard} ${!badge.earned ? styles.badgeCardLocked : ""}`}
                  >
                    <div className={styles.badgeCardEmoji}>{badge.emoji}</div>
                    <div className={styles.badgeCardName}>{badge.name}</div>
                    <div className={styles.badgeCardDesc}>{badge.desc}</div>
                    {!badge.earned && (
                      <div style={{ fontSize: 10, color: "var(--color-text-light)", marginTop: 4 }}>Locked</div>
                    )}
                  </div>
                ))}
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
              <input
                className={styles.formInput}
                value={displayName || user.display_name || ""}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={user.username}
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.formLabel}>Bio</label>
              <textarea
                className={`${styles.formInput} ${styles.formTextarea}`}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell the Pi community about yourself..."
              />
            </div>

            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setShowEdit(false)}>
                Cancel
              </button>
              <button className={styles.modalSave} onClick={() => setShowEdit(false)}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}