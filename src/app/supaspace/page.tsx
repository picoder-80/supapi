"use client";
export const dynamic = "force-dynamic";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import KycBadge from "@/components/ui/KycBadge";
import styles from "./page.module.css";

/* Tab seragam dengan /supaspace/[username] */
const TABS = [
  { id: "bio",       label: "Bio",       emoji: "📝" },
  { id: "reviews",   label: "Reviews",   emoji: "⭐" },
  { id: "status",    label: "Status",     emoji: "📰" },
  { id: "reels",     label: "Reels",     emoji: "🎬" },
];



function getInitial(name: string) { return name?.charAt(0).toUpperCase() ?? "?"; }
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}

export default function MySpacePage() {
  const { user, isHydrating, login, isLoading } = useAuth();
  const router = useRouter();
  const token = typeof window !== "undefined" ? localStorage.getItem("supapi_token") : null;

  const [activeTab,    setActiveTab]   = useState("bio");
  const [showEdit,     setShowEdit]    = useState(false);
  const [saving,       setSaving]      = useState(false);
  const [displayName,  setDisplayName] = useState("");
  const [bio,          setBio]         = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressPostcode, setAddressPostcode] = useState("");
  const [addressCountry, setAddressCountry] = useState("");
  const [avatarUrl,    setAvatarUrl]   = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUrl,      setCoverUrl]      = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [stats,        setStats]       = useState<Record<string, number | string>>({});
  const tabsRef    = useRef<HTMLDivElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
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
    setWalletAddress(user.wallet_address ?? "");
    setAvatarUrl(user.avatar_url ?? null);
    setCoverUrl(user.cover_url ?? null);
  }, [user]);

  useEffect(() => {
    const loadAddress = async () => {
      if (!token) return;
      try {
        const r = await fetch("/api/dashboard/profile", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const d = await r.json();
        if (d?.success && d?.data) {
          setAddressLine1(d.data.address_line1 ?? "");
          setAddressCity(d.data.city ?? "");
          setAddressPostcode(d.data.postcode ?? "");
          setAddressCountry(d.data.country ?? "");
        }
      } catch {}
    };
    if (user) loadAddress();
  }, [user, token]);

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
        body: JSON.stringify({
          display_name: displayName,
          bio,
          wallet_address: walletAddress,
          address_line1: addressLine1,
          city: addressCity,
          postcode: addressPostcode,
          country: addressCountry,
        }),
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
    if (navigator.share) {
      navigator
        .share({ title: `${displayName} on Supapi`, url })
        .catch(async () => {
          try {
            await navigator.clipboard.writeText(url);
            alert("Profile link copied!");
          } catch {
            alert(url);
          }
        });
      return;
    }
    navigator.clipboard
      .writeText(url)
      .then(() => alert("Profile link copied!"))
      .catch(() => alert(url));
  };

  const handleOpenInbox = () => {
    router.push("/supachat");
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

  const editSteps = [
    { id: "display_name", label: "Display name", done: Boolean(displayName.trim()) },
    { id: "bio", label: "Bio", done: Boolean(bio.trim()) },
    { id: "avatar", label: "Profile photo", done: Boolean(avatarUrl?.trim()) },
    { id: "wallet", label: "Pi wallet address", done: Boolean(walletAddress.trim()) },
    {
      id: "address",
      label: "Shipping address",
      done: Boolean(addressLine1.trim() && addressCity.trim() && addressPostcode.trim() && addressCountry.trim()),
    },
  ];


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
            <button type="button" className={styles.messageBtn} onClick={handleOpenInbox} title="Inbox" aria-label="Inbox">
              <span className={styles.actionIcon}>✉</span>
              <span>Inbox</span>
            </button>
            <button type="button" className={styles.shareBtn} onClick={handleShare} title="Share" aria-label="Share">
              <span className={styles.actionIcon}>⤴</span>
              <span>Share</span>
            </button>
          </div>
        </div>

        <div className={styles.displayName}>{displayName}</div>
        {user.kyc_status === "verified" && (
          <div className={styles.kycWrap}>
            <span className={`${styles.metaItem} ${styles.kycVerifiedPill}`}>
              <KycBadge size={14} /> KYC Verified
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

        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEdit && (
        <div className={styles.modalOverlay} onClick={() => setShowEdit(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHandle} />
            <div className={styles.modalTitle}>Edit Profile</div>
            <div className={styles.editSteps}>
              {editSteps.map((step) => (
                <div key={step.id} className={styles.editStep}>
                  <span className={step.done ? styles.editStepDone : styles.editStepPending}>
                    {step.done ? "✓" : "○"}
                  </span>
                  <span>{step.label}</span>
                </div>
              ))}
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Display Name</label>
              <input className={styles.formInput} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={user.username} />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Bio</label>
              <textarea className={`${styles.formInput} ${styles.formTextarea}`} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell the Pi community about yourself..." />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Profile Photo</label>
              <button className={styles.photoPickBtn} onClick={() => fileRef.current?.click()} type="button" disabled={avatarUploading}>
                {avatarUploading ? "Uploading..." : avatarUrl ? "Change profile photo" : "Upload profile photo"}
              </button>
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Pi Wallet Address</label>
              <input
                className={styles.formInput}
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="Paste your Pi wallet address"
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Shipping Address</label>
              <input
                className={styles.formInput}
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="Street address"
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>City</label>
              <input
                className={styles.formInput}
                value={addressCity}
                onChange={(e) => setAddressCity(e.target.value)}
                placeholder="City"
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Postcode</label>
              <input
                className={styles.formInput}
                value={addressPostcode}
                onChange={(e) => setAddressPostcode(e.target.value)}
                placeholder="Postcode"
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Country</label>
              <input
                className={styles.formInput}
                value={addressCountry}
                onChange={(e) => setAddressCountry(e.target.value)}
                placeholder="Country"
              />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setShowEdit(false)}>Cancel</button>
              <button className={styles.modalSave} onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}