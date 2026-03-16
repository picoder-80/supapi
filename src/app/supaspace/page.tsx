"use client";
export const dynamic = "force-dynamic";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./page.module.css";

/* Tab seragam dengan /supaspace/[username] */
const TABS = [
  { id: "bio",       label: "Bio",       emoji: "📝" },
  { id: "reviews",   label: "Reviews",   emoji: "⭐" },
  { id: "status",    label: "Status",     emoji: "📰" },
  { id: "reels",     label: "Reels",     emoji: "🎬" },
  { id: "live",      label: "Live",      emoji: "🔴" },
];



function getInitial(name: string) { return name?.charAt(0).toUpperCase() ?? "?"; }
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}

export default function MySpacePage() {
  const { user, isHydrating, login, isLoading } = useAuth();
  const token = typeof window !== "undefined" ? localStorage.getItem("supapi_token") : null;

  const [activeTab,    setActiveTab]   = useState("bio");
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
  const [showLiveDemo, setShowLiveDemo] = useState(false);
  const [liveViewers]  = useState(() => 128 + Math.floor(Math.random() * 200));
  const [liveComments, setLiveComments] = useState<{ id: number; username: string; text: string }[]>([
    { id: 1, username: "pioneer1", text: "Hello from Pi! 🪐" },
    { id: 2, username: "trader_amy", text: "Nice stream!" },
  ]);
  const [liveLiked, setLiveLiked] = useState(false);
  const [liveLikeCount, setLiveLikeCount] = useState(42);
  const [liveCommentInput, setLiveCommentInput] = useState("");
  const liveCommentInputRef = useRef<HTMLInputElement>(null);
  const tabsRef    = useRef<HTMLDivElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const [reviewsList, setReviewsList] = useState<{ id: string; rating: number; comment: string | null; created_at: string; platform: string; reviewer: { username: string; display_name: string | null; avatar_url: string | null } }[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [statusPosts, setStatusPosts] = useState<{ id: string; body: string; created_at: string }[]>([]);
  const [statusLoading, setStatusLoading] = useState(false);

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
    setBio(user.bio ?? "");
    setAvatarUrl(user.avatar_url ?? null);
    setCoverUrl(user.cover_url ?? null);
  }, [user]);

  // Fetch real stats
  const fetchStats = useCallback(async (username: string) => {
    try {
      const r = await fetch(`/api/supaspace/stats/${username}`);
      const d = await r.json();
      if (d.success) setStats(d.data);
    } catch {}
  }, []);

  useEffect(() => {
    if (user?.username) fetchStats(user.username);
  }, [user, fetchStats]);

  // Fetch reviews when Reviews tab active (seragam dengan [username])
  useEffect(() => {
    if (activeTab !== "reviews" || !user?.username) return;
    setReviewsLoading(true);
    fetch(`/api/supaspace/reviews/${encodeURIComponent(user.username)}`)
      .then(r => r.json())
      .then(d => { if (d.success && d.data?.reviews) setReviewsList(d.data.reviews); else setReviewsList([]); })
      .catch(() => setReviewsList([]))
      .finally(() => setReviewsLoading(false));
  }, [activeTab, user?.username]);

  // Fetch status when Status tab active (seragam dengan [username])
  useEffect(() => {
    if (activeTab !== "status" || !user?.username) return;
    setStatusLoading(true);
    fetch(`/api/supaspace/status/${encodeURIComponent(user.username)}`)
      .then(r => r.json())
      .then(d => { if (d.success && d.data?.posts) setStatusPosts(d.data.posts); else setStatusPosts([]); })
      .catch(() => setStatusPosts([]))
      .finally(() => setStatusLoading(false));
  }, [activeTab, user?.username]);

  // Save profile
  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const r = await fetch("/api/supaspace/profile", {
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
      const r = await fetch("/api/supaspace/avatar", {
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
      const r = await fetch("/api/supaspace/cover", {
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
    <div className={styles.loadingPage}>
      <span className={styles.loadingText}>Loading...</span>
    </div>
  );

  if (!user) return (
    <div className={styles.guestPage}>
      <div className={styles.guestIcon}>🪐</div>
      <h1 className={styles.guestTitle}>Your SupaSpace</h1>
      <p className={styles.guestSub}>Your personal Pi identity across all 15 platforms.</p>
      <button className={styles.guestBtn} onClick={() => login()} disabled={isLoading}>
        {isLoading ? "Connecting..." : "π Sign in with Pi"}
      </button>
    </div>
  );


  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.topBarTitle}>SupaSpace</div>
      </header>
      {/* Cover + Avatar */}
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
          <input ref={coverFileRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={handleCoverChange} />
        </div>

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
          <input ref={fileRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={handleAvatarChange} />
        </div>
      </div>

      {/* Profile Header — Online & @username bawah cover; actions, name, KYC, wallet, stats */}
      <div className={styles.profileHeader}>
        <div className={styles.headerBarRow}>
          <div className={styles.headerOnlineIndicator} aria-label="Online">
            <span className={`${styles.onlineDot} ${styles.onlineDotActive}`} />
            <span className={`${styles.onlineLabel} ${styles.onlineLabelActive}`}>Online</span>
          </div>
          <div className={styles.usernameCoverCorner}><span className={styles.usernamePi}>π</span> @{user.username}</div>
        </div>
        <div className={styles.avatarRow}>
          <div className={styles.avatarActions}>
            <button type="button" className={styles.messageBtn} onClick={() => setShowMsg(true)} title="Message" aria-label="Message">💬</button>
            <button type="button" className={styles.shareBtn} onClick={handleShare} title="Share" aria-label="Share">🔗</button>
          </div>
        </div>

        <div className={styles.displayName}>{displayName}</div>
        {user.kyc_status === "verified" && (
          <div className={styles.kycWrap}>
            <span className={`${styles.metaItem} ${styles.kycVerifiedPill}`}>
              ✅ KYC Verified
            </span>
          </div>
        )}

        {user.wallet_address && (
          <div className={styles.metaRow}>
            <span
              className={`${styles.metaItem} ${styles.walletCopy}`}
              onClick={() => { navigator.clipboard.writeText(user.wallet_address!); alert("Wallet address copied!"); }}
              title="Click to copy wallet address"
            >
              <span className={styles.metaIcon}>⧉</span>
              {user.wallet_address.slice(0, 8)}...{user.wallet_address.slice(-6)}
            </span>
          </div>
        )}

        {/* Stats — 6 lajur ikut screenshot */}
        <div className={styles.statsBar}>
          {user?.username ? (
            <Link href={`/supaspace/${user.username}/followers`} className={styles.statItem}>
              <div className={styles.statValue}>{stats.followers ?? 0}</div>
              <div className={styles.statLabel}>Followers</div>
            </Link>
          ) : (
            <div className={styles.statItem}>
              <div className={styles.statValue}>{stats.followers ?? 0}</div>
              <div className={styles.statLabel}>Followers</div>
            </div>
          )}
          {user?.username ? (
            <Link href={`/supaspace/${user.username}/following`} className={styles.statItem}>
              <div className={styles.statValue}>{stats.following ?? 0}</div>
              <div className={styles.statLabel}>Following</div>
            </Link>
          ) : (
            <div className={styles.statItem}>
              <div className={styles.statValue}>{stats.following ?? 0}</div>
              <div className={styles.statLabel}>Following</div>
            </div>
          )}
          <div className={styles.statItem}>
            <div className={styles.statValue}>
              {(Number(stats.listings ?? 0) + Number(stats.gigs ?? 0) + Number(stats.courses ?? 0) + Number(stats.stays ?? 0)
                + Number(stats.jobs ?? 0) + Number(stats.classifieds ?? 0) + Number(stats.bulk ?? 0) + Number(stats.machina ?? 0) + Number(stats.domus ?? 0) + Number(stats.endoro ?? 0))}
            </div>
            <div className={styles.statLabel}>Listings</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{stats.avg_rating ?? "5.0"}⭐</div>
            <div className={styles.statLabel}>Rating</div>
          </div>
          {user?.username ? (
            <Link href={`/supaspace/${user.username}/referrals`} className={styles.statItem}>
              <div className={styles.statValue}>{stats.referrals ?? 0}</div>
              <div className={styles.statLabel}>Referrals</div>
            </Link>
          ) : (
            <div className={styles.statItem}>
              <div className={styles.statValue}>{stats.referrals ?? 0}</div>
              <div className={styles.statLabel}>Referrals</div>
            </div>
          )}
          {user?.username ? (
            <Link href={`/supaspace/${user.username}/pets`} className={styles.statItem}>
              <div className={styles.statValue}>{stats.pets ?? 0}</div>
              <div className={styles.statLabel}>Pets</div>
            </Link>
          ) : (
            <div className={styles.statItem}>
              <div className={styles.statValue}>{stats.pets ?? 0}</div>
              <div className={styles.statLabel}>Pets</div>
            </div>
          )}
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
              <div className={styles.bioJoined}>📅 Joined {formatDate(user.created_at)}</div>
              {bio ? (
                <div className={styles.bioText}>{bio}</div>
              ) : (
                <div className={styles.empty}>
                  <div className={styles.emptyIcon}>📝</div>
                  <div className={styles.emptyTitle}>No bio yet</div>
                  <div className={styles.emptyDesc}>Tell others about yourself. Edit profile to add a bio.</div>
                  <button type="button" className={styles.emptyBtn} onClick={() => setShowEdit(true)}>Edit Profile</button>
                </div>
              )}
            </div>
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
                  <div className={styles.emptyTitle}>No status updates yet</div>
                  <div className={styles.emptyDesc}>Share what's on your mind with your followers.</div>
                  <Link href="/newsfeed" className={styles.emptyBtn}>Post Status →</Link>
                </div>
              ) : (
                <div className={styles.statusList}>
                  {statusPosts.map((p) => (
                    <div key={p.id} className={styles.statusCard}>
                      <div className={styles.statusBody}>{p.body}</div>
                      <div className={styles.statusDate}>{formatDate(p.created_at)}</div>
                    </div>
                  ))}
                  <Link href="/newsfeed" className={styles.statusCreateBtn}>+ Post Status</Link>
                </div>
              )}
            </>
          )}

          {activeTab === "reels" && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🎬</div>
              <div className={styles.emptyTitle}>No reels yet</div>
              <div className={styles.emptyDesc}>Share short videos with the Pi community.</div>
              <Link href="/reels/create" className={styles.emptyBtn}>+ Upload Reel</Link>
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
                        <Link href={`/supaspace/${r.reviewer.username}`}>
                          <div className={styles.reviewAvatar}>
                            {r.reviewer.avatar_url ? <img src={r.reviewer.avatar_url} alt="" /> : getInitial(r.reviewer.username)}
                          </div>
                        </Link>
                        <div className={styles.reviewHeaderMeta}>
                          <div className={styles.reviewerName}>
                            <Link href={`/supaspace/${r.reviewer.username}`}>{r.reviewer.display_name ?? r.reviewer.username}</Link>
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
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "live" && (
            <>
              {!showLiveDemo ? (
                <div className={styles.liveEmpty}>
                  <div className={styles.liveEmptyIcon}>🔴</div>
                  <div className={styles.liveEmptyTitle}>You're not live</div>
                  <div className={styles.liveEmptyDesc}>Go live to connect with your followers and receive gifts.</div>
                  <Link href="/live/go" className={styles.liveGoLiveBtn}>Go Live</Link>
                </div>
              ) : (
                <div className={styles.liveRoom}>
                  <div className={styles.liveVideo}>
                    <div className={styles.liveVideoPlaceholder} />
                    <span className={styles.liveBadge}>● LIVE</span>
                    <span className={styles.liveViewerCount}>👁 {liveViewers}</span>
                    <div className={styles.liveHostBar}>
                      <span className={styles.liveHostAvatar}>{avatarUrl ? <img src={avatarUrl} alt="" /> : getInitial(displayName)}</span>
                      <span className={styles.liveHostName}>@{user.username}</span>
                    </div>
                    <div className={styles.liveCommentsStrip}>
                      {liveComments.slice(-5).map(c => (
                        <div key={c.id} className={styles.liveComment}>
                          <span className={styles.liveCommentUser}>@{c.username}</span>
                          <span className={styles.liveCommentText}>{c.text}</span>
                        </div>
                      ))}
                    </div>
                    <div className={styles.liveActionsBar}>
                      <button type="button" className={styles.liveActionBtn} onClick={() => { setLiveLiked(p => !p); setLiveLikeCount(c => c + (liveLiked ? -1 : 1)); }} aria-label="Like">
                        <span className={styles.liveActionIcon}>{liveLiked ? "❤️" : "🤍"}</span>
                        <span className={styles.liveActionCount}>{liveLikeCount}</span>
                      </button>
                      <button type="button" className={styles.liveActionBtn} aria-label="Comment">
                        <span className={styles.liveActionIcon}>💬</span>
                        <span className={styles.liveActionCount}>{liveComments.length}</span>
                      </button>
                      <button type="button" className={styles.liveActionBtn} onClick={() => { if (navigator.share) navigator.share({ title: `${user.username} is live on Supapi`, url: window.location.href }); else { navigator.clipboard?.writeText(window.location.href); alert("Link copied!"); } }} aria-label="Share">
                        <span className={styles.liveActionIcon}>🔗</span>
                        <span className={styles.liveActionLabel}>Share</span>
                      </button>
                    </div>
                  </div>
                  <button className={styles.liveExitDemo} type="button" onClick={() => setShowLiveDemo(false)}>End Live</button>
                </div>
              )}
            </>
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
            <div className={styles.messageSoon}>
              <div className={styles.messageSoonIcon}>🚀</div>
              <div className={styles.messageSoonTitle}>Coming Soon</div>
              <div className={styles.messageSoonText}>Direct messaging between Pi users is coming soon!</div>
            </div>
            <button className={styles.modalSave} onClick={() => setShowMsg(false)}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}