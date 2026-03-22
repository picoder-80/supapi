"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useProfileOnline } from "@/components/providers/PresenceProvider";
import SendPiModal from "@/components/supachat/SendPiModal";
import ToastBanner from "@/components/ui/ToastBanner";
import KycBadge from "@/components/ui/KycBadge";
import styles from "../page.module.css";

/* Susunan tab seragam dengan /supaspace: Bio, Reviews, Status, Reels */
const TABS = [
  { id: "bio",      label: "Bio",      emoji: "📝" },
  { id: "reviews",  label: "Reviews",  emoji: "⭐" },
  { id: "status",   label: "Status",   emoji: "📰" },
  { id: "reels",    label: "Reels",    emoji: "🎬" },
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
  const [activeTab,  setActiveTab] = useState("bio");
  const [following,  setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [stats,      setStats]     = useState<Record<string, number | string>>({});
  const tabsRef = useRef<HTMLDivElement>(null);
  const [reviewsList, setReviewsList] = useState<{
    id: string;
    rating: number;
    comment: string | null;
    images?: string[];
    created_at: string;
    platform: string;
    reviewer: { username: string; display_name: string | null; avatar_url: string | null };
  }[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [statusPosts, setStatusPosts] = useState<{ id: string; body: string; created_at: string }[]>([]);
  const [statusLoading, setStatusLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [tipModalOpen, setTipModalOpen] = useState(false);

  const isOwnProfile = me?.username === username;

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2800);
  };

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

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Fetch stats
  useEffect(() => {
    fetch(`/api/supaspace/stats/${username}`)
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d.data); })
      .catch(() => {});
  }, [username]);

  // Fetch follow status when logged in (so button shows "Following ✓" if already following)
  useEffect(() => {
    if (!me || !username || isOwnProfile) return;
    const t = typeof window !== "undefined" ? localStorage.getItem("supapi_token") : null;
    if (!t) return;
    fetch(`/api/supaspace/follow?username=${encodeURIComponent(username)}`, {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then(r => r.json())
      .then(d => { if (d.success && d.data?.following !== undefined) setFollowing(d.data.following); })
      .catch(() => {});
  }, [me, username, isOwnProfile]);

  // Fetch reviews from all platforms when Reviews tab is active
  useEffect(() => {
    if (activeTab !== "reviews") return;
    setReviewsLoading(true);
    fetch(`/api/supaspace/reviews/${encodeURIComponent(username)}`)
      .then(r => r.json())
      .then(d => { if (d.success && d.data?.reviews) setReviewsList(d.data.reviews); else setReviewsList([]); })
      .catch(() => setReviewsList([]))
      .finally(() => setReviewsLoading(false));
  }, [activeTab, username]);

  // Fetch status posts when Status tab active
  useEffect(() => {
    if (activeTab !== "status") return;
    setStatusLoading(true);
    fetch(`/api/supaspace/status/${encodeURIComponent(username)}`)
      .then(r => r.json())
      .then(d => { if (d.success && d.data?.posts) setStatusPosts(d.data.posts); else setStatusPosts([]); })
      .catch(() => setStatusPosts([]))
      .finally(() => setStatusLoading(false));
  }, [activeTab, username]);

  const fromHook = useProfileOnline(profile?.id);
  const isOnline = isOwnProfile && me ? true : fromHook;

  const handleFollow = async () => {
    if (!me) {
      window.location.href = "/dashboard";
      return;
    }
    const t = typeof window !== "undefined" ? localStorage.getItem("supapi_token") : null;
    if (!t) {
      alert("Sesi tamat. Sila sign in semula.");
      window.location.href = "/dashboard";
      return;
    }
    setFollowLoading(true);
    try {
      const method = following ? "DELETE" : "POST";
      const r = await fetch("/api/supaspace/follow", {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ username }),
      });
      const d = await r.json();
      if (d.success) {
        setFollowing(d.data.following);
        setStats(prev => ({
          ...prev,
          followers: Number(prev.followers ?? 0) + (d.data.following ? 1 : -1)
        }));
      } else {
        alert(d.error || "Gagal. Cuba lagi.");
      }
    } catch {
      alert("Permintaan gagal. Cuba lagi.");
    }
    setFollowLoading(false);
  };

  const handleShare = () => {
    if (navigator.share) navigator.share({ title: `${username} on Supapi`, url: window.location.href });
    else { navigator.clipboard.writeText(window.location.href); alert("Profile link copied!"); }
  };

  const handleMessage = async () => {
    if (!me || !token) {
      alert("Sign in required");
      window.location.href = "/dashboard";
      return;
    }
    if (!profile?.id) return;
    try {
      const r = await fetch("/api/supachat/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ receiverId: profile.id }),
      });
      const d = await r.json();
      if (d.success && d.data?.conversationId) {
        window.location.href = `/supachat/dm/${d.data.conversationId}`;
      } else {
        alert(d.error || "Unable to open chat");
      }
    } catch {
      alert("Unable to open chat");
    }
  };

  const openTipModal = () => {
    if (!me || !token) {
      alert("Sign in required");
      window.location.href = "/dashboard";
      return;
    }
    if (!profile?.id) return;
    setTipModalOpen(true);
  };

  if (loading) return (
    <div className={styles.loadingPage}>
      <span className={styles.loadingText}>Loading profile...</span>
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

  return (
    <div className={styles.page}>
      {toast && <ToastBanner type={toast.type} message={toast.msg} />}
      {tipModalOpen && profile?.id && token && (
        <SendPiModal
          onClose={() => setTipModalOpen(false)}
          onSuccess={() => showToast("Tip sent!", "success")}
          onCancelled={() => showToast("Payment cancelled", "error")}
          onError={(msg) => showToast(msg, "error")}
          receiverId={profile.id}
          receiverUsername={username}
          token={token}
          senderId={me?.id}
          defaultNote={`Tip for @${username}`}
          redirectToDm
          canReceivePi={!!profile?.can_receive_pi}
        />
      )}
      <header className={styles.publicTopBar}>
        <Link href="/supaspace" className={styles.publicTopIconBtn} aria-label="Back">
          ←
        </Link>
        <div className={styles.publicTopBarCenter}>
          <div className={styles.publicTopBarTitle}>@{username}</div>
          <div className={styles.publicTopBarSub}>SupaSpace Profile</div>
        </div>
        <button type="button" className={styles.publicTopIconBtn} onClick={handleShare} aria-label="Share profile">
          🔗
        </button>
      </header>
      {/* Cover + Avatar */}
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
              <Link href="/supaspace" className={styles.coverEditBtn}>✏️ Edit Profile</Link>
            </div>
          )}
        </div>

        <div className={styles.avatarAnchor}>
          <div className={`${styles.avatarWrapper} ${styles.avatarStatic}`}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={name} className={styles.avatarImg} />
            ) : (
              <div className={styles.avatar}>{getInitial(name)}</div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Header — Online & @username bawah cover; actions, name, KYC, wallet, stats */}
      <div className={styles.profileHeader}>
        <div className={styles.headerBarRow}>
          <div className={styles.headerOnlineIndicator} aria-label={isOnline ? "Online" : "Offline"}>
            <span className={`${styles.onlineDot} ${isOnline ? styles.onlineDotActive : styles.onlineDotOffline}`} />
            <span className={`${styles.onlineLabel} ${isOnline ? styles.onlineLabelActive : styles.onlineLabelOffline}`}>
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
          <div className={styles.usernameCoverCorner}><span className={styles.usernamePi}>π</span> @{username}</div>
        </div>
        <div className={styles.avatarRow}>
          <div className={styles.avatarActions}>
            {!isOwnProfile && (
              <button
                type="button"
                className={`${styles.followBtn} ${following ? styles.followingBtn : ""}`}
                onClick={handleFollow}
                disabled={followLoading}
                title={following ? "Klik untuk unfollow" : ""}
              >
                {followLoading ? "..." : following ? "Unfollow" : me ? "+ Follow" : "Sign in to follow"}
              </button>
            )}
            <button type="button" className={styles.messageBtn} onClick={handleMessage} title="Message" aria-label="Message">
              <span className={styles.actionIcon}>✉</span>
              <span>Message</span>
            </button>
            <button type="button" className={styles.tipBtn} onClick={openTipModal} title="Tip" aria-label="Tip">π Tip</button>
            <button type="button" className={styles.shareBtn} onClick={handleShare} title="Share" aria-label="Share">
              <span className={styles.actionIcon}>⤴</span>
              <span>Share</span>
            </button>
          </div>
        </div>

        <div className={styles.displayName}>{name}</div>
        {profile?.kyc_status === "verified" && (
          <div className={styles.kycWrap}>
            <span className={`${styles.metaItem} ${styles.kycVerifiedPill}`}>
              <KycBadge size={14} /> KYC Verified
            </span>
          </div>
        )}

        {profile?.wallet_address && (
          <div className={styles.metaRow}>
            <span className={styles.metaItem} title="Public wallet address">
              <span className={styles.metaIcon}>⧉</span>
              {profile.wallet_address.slice(0, 8)}...{profile.wallet_address.slice(-6)}
            </span>
          </div>
        )}



        {/* Stats — real data; Followers & Following link to detail pages */}
        <div className={styles.statsBar}>
          <Link href={`/myspace/${username}/followers`} className={styles.statItem}>
            <div className={styles.statValue}>{stats.followers ?? 0}</div>
            <div className={styles.statLabel}>Followers</div>
          </Link>
          <Link href={`/myspace/${username}/following`} className={styles.statItem}>
            <div className={styles.statValue}>{stats.following ?? 0}</div>
            <div className={styles.statLabel}>Following</div>
          </Link>
          <Link href={`/myspace/${username}/listings`} className={styles.statItem}>
            <div className={styles.statValue}>
              {(Number(stats.listings ?? 0) + Number(stats.gigs ?? 0) + Number(stats.courses ?? 0) + Number(stats.stays ?? 0)
                + Number(stats.jobs ?? 0) + Number(stats.classifieds ?? 0) + Number(stats.bulk ?? 0) + Number(stats.machina ?? 0) + Number(stats.domus ?? 0) + Number(stats.endoro ?? 0))}
            </div>
            <div className={styles.statLabel}>Listings</div>
          </Link>
          <Link href={`/myspace/${username}/reviews`} className={styles.statItem}>
            <div className={styles.statValue}>{stats.avg_rating ?? "5.0"}⭐</div>
            <div className={styles.statLabel}>Rating</div>
          </Link>
          <Link href={`/myspace/${username}/referrals`} className={styles.statItem}>
            <div className={styles.statValue}>{stats.referrals ?? 0}</div>
            <div className={styles.statLabel}>Referrals</div>
          </Link>
          <Link href={`/myspace/${username}/pets`} className={styles.statItem}>
            <div className={styles.statValue}>{stats.pets ?? 0}</div>
            <div className={styles.statLabel}>Pets</div>
          </Link>
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
          {activeTab === "bio" && (
            <div className={styles.bioTab}>
              {profile?.created_at && (
                <div className={styles.bioJoined}>📅 Joined {formatDate(profile.created_at)}</div>
              )}
              {profile?.bio ? (
                <div className={styles.bioText}>{profile.bio}</div>
              ) : (
                <div className={styles.empty}>
                  <div className={styles.emptyIcon}>📝</div>
                  <div className={styles.emptyTitle}>{isOwnProfile ? "No bio yet" : `@${username} has no bio`}</div>
                  <div className={styles.emptyDesc}>
                    {isOwnProfile ? "Tell others about yourself. Edit profile to add a bio." : `@${username} has not added a bio yet.`}
                  </div>
                  {isOwnProfile && (
                    <Link href="/myspace" className={styles.emptyBtn}>Edit Profile</Link>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "reviews" && (
            <>
              {reviewsLoading ? (
                <div className={styles.empty}>
                  <div className={styles.emptyIcon}>⏳</div>
                  <div className={styles.emptyTitle}>Loading reviews...</div>
                </div>
              ) : reviewsList.length === 0 ? (
                <div className={styles.empty}>
                  <div className={styles.emptyIcon}>⭐</div>
                  <div className={styles.emptyTitle}>No reviews yet</div>
                  <div className={styles.emptyDesc}>Reviews from SupaMarket, SupaSkil, SupaDemy, SupaDomus & profile will appear here.</div>
                </div>
              ) : (
                <div className={styles.reviewList}>
                  {reviewsList.map((r) => (
                    <div key={r.id} className={styles.reviewCard}>
                      <div className={styles.reviewHeader}>
                        <Link href={`/myspace/${r.reviewer.username}`}>
                          <div className={styles.reviewAvatar}>
                            {r.reviewer.avatar_url ? <img src={r.reviewer.avatar_url} alt="" /> : getInitial(r.reviewer.username)}
                          </div>
                        </Link>
                        <div className={styles.reviewHeaderMeta}>
                          <div className={styles.reviewerName}>
                            <Link href={`/myspace/${r.reviewer.username}`}>{r.reviewer.display_name ?? r.reviewer.username}</Link>
                            <span className={styles.reviewPlatform}> · {r.platform}</span>
                          </div>
                          <div className={styles.reviewDate}>{formatDate(r.created_at)}</div>
                        </div>
                      </div>
                      <div className={styles.reviewStars}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <span key={i} className={i <= r.rating ? styles.starFilled : styles.starEmpty}>★</span>
                        ))}
                      </div>
                      {r.comment && <div className={styles.reviewText}>{r.comment}</div>}
                      {r.images && r.images.length > 0 && (
                        <div className={styles.reviewPhotoThumbs}>
                          {r.images.map((url) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.reviewPhotoThumbLink}
                            >
                              <img src={url} alt="" className={styles.reviewPhotoThumb} />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "status" && (
            <>
              {statusLoading ? (
                <div className={styles.empty}>
                  <div className={styles.emptyIcon}>⏳</div>
                  <div className={styles.emptyTitle}>Loading...</div>
                </div>
              ) : statusPosts.length === 0 ? (
                <div className={styles.empty}>
                  <div className={styles.emptyIcon}>📰</div>
                  <div className={styles.emptyTitle}>{isOwnProfile ? "No status updates yet" : `@${username} has not posted`}</div>
                  <div className={styles.emptyDesc}>
                    {isOwnProfile ? "Share what's on your mind with your followers." : `@${username} has not shared any status updates yet.`}
                  </div>
                  {isOwnProfile && (
                    <Link href="/newsfeed" className={styles.emptyBtn}>Post Status →</Link>
                  )}
                </div>
              ) : (
                <div className={styles.statusList}>
                  {statusPosts.map((p) => (
                    <div key={p.id} className={styles.statusCard}>
                      <div className={styles.statusBody}>{p.body}</div>
                      <div className={styles.statusDate}>{formatDate(p.created_at)}</div>
                    </div>
                  ))}
                  {isOwnProfile && (
                    <Link href="/newsfeed" className={styles.statusCreateBtn}>+ Post Status</Link>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === "reels" && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🎬</div>
              <div className={styles.emptyTitle}>{isOwnProfile ? "No reels yet" : `@${username} has no reels`}</div>
              <div className={styles.emptyDesc}>
                {isOwnProfile ? "Share short videos with the Pi community." : `@${username} has not uploaded any reels yet.`}
              </div>
              {isOwnProfile && (
                <Link href="/reels/create" className={styles.emptyBtn}>+ Upload Reel</Link>
              )}
            </div>
          )}

        </div>
      </div>

    </div>
  );
}