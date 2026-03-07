"use client";

export const dynamic = "force-dynamic";

// app/myspace/[username]/page.tsx — Public profile view

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "../page.module.css";

const TABS = [
  { id: "overview", label: "Overview", emoji: "🪐" },
  { id: "listings", label: "Market",   emoji: "🛍️" },
  { id: "gigs",     label: "Gigs",     emoji: "💼" },
  { id: "content",  label: "Content",  emoji: "🎬" },
  { id: "reviews",  label: "Reviews",  emoji: "⭐" },
  { id: "badges",   label: "Badges",   emoji: "🏆" },
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

export default function PublicProfilePage() {
  const params         = useParams();
  const username       = params.username as string;
  const { user: me }   = useAuth();
  const [profile,      setProfile]    = useState<any>(null);
  const [loading,      setLoading]    = useState(true);
  const [notFound,     setNotFound]   = useState(false);
  const [activeTab,    setActiveTab]  = useState("overview");
  const [following,    setFollowing]  = useState(false);

  useEffect(() => {
    // Fetch public profile
    fetch(`/api/users/${username}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setProfile(d.data.user);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [username]);

  const isOwnProfile = me?.username === username;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: `${username} on Supapi`, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Profile link copied!");
    }
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
      <p className={styles.guestSub}>@{username} doesn't exist on Supapi yet.</p>
      <Link href="/" className={styles.emptyBtn}>← Back to Home</Link>
    </div>
  );

  const name = profile?.display_name || profile?.username || username;

  return (
    <div>
      {/* ── Cover ── */}
      <div className={styles.cover}>
        <div className={`${styles.coverOrb} ${styles.coverOrb1}`} />
        <div className={`${styles.coverOrb} ${styles.coverOrb2}`} />
        <div className={`${styles.coverOrb} ${styles.coverOrb3}`} />
        {isOwnProfile && (
          <Link href="/myspace" className={styles.coverEditBtn}>✏️ Edit Profile</Link>
        )}
      </div>

      {/* ── Profile Header ── */}
      <div className={styles.profileHeader}>
        <div className={styles.avatarRow}>
          <div className={styles.avatar}>
            {getInitial(name)}
            <div className={styles.avatarOnline} />
          </div>
          <div className={styles.avatarActions}>
            {!isOwnProfile && (
              <>
                <button
                  className={`${styles.followBtn} ${following ? styles.followingBtn : ""}`}
                  onClick={() => setFollowing(!following)}
                >
                  {following ? "Following ✓" : "+ Follow"}
                </button>
                <button className={styles.messageBtn}>💬</button>
              </>
            )}
            <button className={styles.shareBtn} onClick={handleShare}>🔗</button>
          </div>
        </div>

        <div className={styles.displayName}>{name}</div>
        <div className={styles.username}>
          <span className={styles.usernamePi}>π</span> @{username}
        </div>

        <div className={styles.metaRow}>
          {profile?.created_at && (
            <span className={styles.metaItem}>
              <span className={styles.metaIcon}>📅</span>
              Joined {formatDate(profile.created_at)}
            </span>
          )}
          <span className={styles.metaItem}>
            <span className={styles.metaIcon}>📍</span>
            Pi Network
          </span>
        </div>

        {/* Badges */}
        <div className={styles.badgesRow}>
          <span className={styles.badge}>🪐 Pioneer</span>
          {profile?.kyc_status === "verified" && (
            <span className={`${styles.badge} ${styles.badgeKyc}`}>✅ KYC Verified</span>
          )}
          {profile?.role === "admin" && (
            <span className={`${styles.badge} ${styles.badgeAdmin}`}>⚙️ Admin</span>
          )}
          {profile?.role === "seller" && (
            <span className={`${styles.badge} ${styles.badgeSeller}`}>🏪 Seller</span>
          )}
        </div>

        {/* Stats */}
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
            <div className={styles.statValue}>5.0⭐</div>
            <div className={styles.statLabel}>Rating</div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
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
            <div className={styles.overviewGrid}>
              {[
                { emoji: "🛍️", label: "Listings",   count: 0 },
                { emoji: "💼", label: "Gigs",        count: 0 },
                { emoji: "📚", label: "Courses",     count: 0 },
                { emoji: "🎬", label: "Content",     count: 0 },
                { emoji: "⭐", label: "Reviews",     count: 0 },
                { emoji: "🏆", label: "Badges",      count: ALL_BADGES.filter(b => b.earned).length },
              ].map((item) => (
                <div key={item.label} className={styles.overviewCard}>
                  <div className={styles.overviewCardHeader}>
                    <span className={styles.overviewCardEmoji}>{item.emoji}</span>
                    <span className={styles.overviewCardCount}>{item.count}</span>
                  </div>
                  <div className={styles.overviewCardLabel}>{item.label}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "listings" && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🛍️</div>
              <div className={styles.emptyTitle}>No listings yet</div>
              <div className={styles.emptyDesc}>@{username} hasn't listed anything for sale yet.</div>
            </div>
          )}

          {activeTab === "gigs" && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>💼</div>
              <div className={styles.emptyTitle}>No gigs yet</div>
              <div className={styles.emptyDesc}>@{username} hasn't offered any services yet.</div>
            </div>
          )}

          {activeTab === "content" && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🎬</div>
              <div className={styles.emptyTitle}>No content yet</div>
              <div className={styles.emptyDesc}>@{username} hasn't posted any content yet.</div>
            </div>
          )}

          {activeTab === "reviews" && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>⭐</div>
              <div className={styles.emptyTitle}>No reviews yet</div>
              <div className={styles.emptyDesc}>@{username} hasn't received any reviews yet.</div>
            </div>
          )}

          {activeTab === "badges" && (
            <div>
              <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 16 }}>
                {ALL_BADGES.filter(b => b.earned).length} / {ALL_BADGES.length} badges earned
              </div>
              <div className={styles.badgesGrid}>
                {ALL_BADGES.map((badge) => (
                  <div key={badge.name} className={`${styles.badgeCard} ${!badge.earned ? styles.badgeCardLocked : ""}`}>
                    <div className={styles.badgeCardEmoji}>{badge.emoji}</div>
                    <div className={styles.badgeCardName}>{badge.name}</div>
                    <div className={styles.badgeCardDesc}>{badge.desc}</div>
                    {!badge.earned && <div style={{ fontSize: 10, color: "var(--color-text-light)", marginTop: 4 }}>🔒 Locked</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}