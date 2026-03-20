"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import styles from "../../supamarket/my-listings/page.module.css";
import { formatListingCategoryPath } from "@/lib/supasifieds/categories";
import { CLASSIFIED_BOOST_TIERS } from "@/lib/supasifieds/boost-tiers";
import { formatPiPriceDisplay } from "@/lib/supasifieds/price";

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d === 0 ? "Today" : d === 1 ? "Yesterday" : `${d}d ago`;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "#276749", bg: "#F0FFF4" },
  paused: { label: "Paused", color: "#744210", bg: "#FFFAF0" },
  deleted: { label: "Deleted", color: "#9B2335", bg: "#FFF5F5" },
  removed: { label: "Archived", color: "#4A5568", bg: "#EDF2F7" },
};

const STATUS_CLASS: Record<string, string> = {
  active: styles.statusActive,
  paused: styles.statusPaused,
  deleted: styles.statusDeleted,
  removed: styles.statusArchived,
};

export default function SupasifiedsMyListingsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [listings, setListings] = useState<Record<string, unknown>[]>([]);
  const [archivedListings, setArchivedListings] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "paused">("all");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [boostListing, setBoostListing] = useState<{
    id: string;
    title: string;
    image?: string;
    priceLabel?: string;
  } | null>(null);
  const [boostTier, setBoostTier] = useState("");
  const [boosting, setBoosting] = useState(false);
  const [scBalance, setScBalance] = useState<number | null>(null);
  const [promoteTab, setPromoteTab] = useState<"boost" | "spotlight" | "autorepost" | "carousel">("boost");
  const [spotlightDays, setSpotlightDays] = useState(7);
  const [autorepostPkg, setAutorepostPkg] = useState("24h_7d");
  const [carouselDays, setCarouselDays] = useState(7);
  const [carouselHeadline, setCarouselHeadline] = useState("");
  const [promoting, setPromoting] = useState(false);

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "");

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchListings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await fetch("/api/supasifieds/listings/mine", { headers: { Authorization: `Bearer ${token()}` } });
      const d = await r.json();
      if (d.success) setListings(d.data ?? []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [user]);

  const fetchArchivedListings = useCallback(async () => {
    if (!user) return;
    setArchivedLoading(true);
    try {
      const r = await fetch("/api/supasifieds/listings/mine?archived=true", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (d.success) setArchivedListings(d.data ?? []);
    } catch {
      /* ignore */
    }
    setArchivedLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      router.push("/dashboard");
      return;
    }
    fetchListings();
  }, [user, fetchListings, router]);

  useEffect(() => {
    if (user) fetchArchivedListings();
  }, [user, fetchArchivedListings]);

  const fetchScBalance = useCallback(async () => {
    const t = token();
    if (!t) return;
    try {
      const r = await fetch("/api/wallet?tab=sc", { headers: { Authorization: `Bearer ${t}` } });
      const d = await r.json();
      if (d.success && d.data?.scWallet?.balance != null) setScBalance(d.data.scWallet.balance);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (user) fetchScBalance();
  }, [user, fetchScBalance]);

  const handleBoost = async () => {
    if (!boostListing || !boostTier || !CLASSIFIED_BOOST_TIERS[boostTier]) return;
    const t = token();
    if (!t) return;
    setBoosting(true);
    try {
      const r = await fetch("/api/supasifieds/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ classified_id: boostListing.id, tier: boostTier }),
      });
      const d = await r.json();
      if (d.success) {
        showToast(`Boost! ${CLASSIFIED_BOOST_TIERS[boostTier].label}`);
        setBoostListing(null);
        setBoostTier("");
        fetchListings();
        fetchScBalance();
      } else showToast(d.error ?? "Boost failed", "error");
    } catch {
      showToast("Something went wrong", "error");
    }
    setBoosting(false);
  };

  const handleSpotlight = async () => {
    if (!boostListing) return;
    const t = token();
    if (!t) return;
    setPromoting(true);
    try {
      const r = await fetch("/api/supasifieds/promote/spotlight", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ listing_id: boostListing.id, duration_days: spotlightDays }),
      });
      const d = await r.json();
      if (d.success) {
        showToast("Category spotlight activated");
        fetchScBalance();
      } else showToast(d.error ?? "Spotlight failed", "error");
    } catch {
      showToast("Something went wrong", "error");
    }
    setPromoting(false);
  };

  const handleAutoRepost = async () => {
    if (!boostListing) return;
    const t = token();
    if (!t) return;
    setPromoting(true);
    try {
      const r = await fetch("/api/supasifieds/promote/autorepost", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ listing_id: boostListing.id, package_id: autorepostPkg }),
      });
      const d = await r.json();
      if (d.success) {
        showToast("Auto-repost activated");
        fetchListings();
        fetchScBalance();
      } else showToast(d.error ?? "Auto-repost failed", "error");
    } catch {
      showToast("Something went wrong", "error");
    }
    setPromoting(false);
  };

  const handleCarousel = async () => {
    if (!boostListing) return;
    const t = token();
    if (!t) return;
    const linkUrl = `/supasifieds/${boostListing.id}`;
    setPromoting(true);
    try {
      const r = await fetch("/api/supasifieds/promote/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({
          listing_id: boostListing.id,
          image_url: boostListing.image || "",
          headline: (carouselHeadline || boostListing.title).trim(),
          cta_label: "View Ad",
          link_url: linkUrl,
          duration_days: carouselDays,
        }),
      });
      const d = await r.json();
      if (d.success) {
        showToast("Carousel ad is live");
        fetchScBalance();
      } else showToast(d.error ?? "Carousel failed", "error");
    } catch {
      showToast("Something went wrong", "error");
    }
    setPromoting(false);
  };

  const handleStatusChange = async (id: string, status: string) => {
    setActionId(id);
    try {
      const r = await fetch(`/api/supasifieds/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ status }),
      });
      const d = await r.json();
      if (d.success) {
        showToast(status === "paused" ? "Paused" : "Activated");
        fetchListings();
        if (showArchived) fetchArchivedListings();
      } else showToast(d.error ?? "Failed", "error");
    } catch {
      showToast("Something went wrong", "error");
    }
    setActionId(null);
  };

  const handleDeleteListing = async (id: string) => {
    setActionId(id);
    try {
      const r = await fetch(`/api/supasifieds/listings/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (d.success) {
        showToast("Ad removed");
        setListings((prev) => prev.filter((l) => l.id !== id));
      } else showToast(d.error ?? "Failed", "error");
    } catch {
      showToast("Something went wrong", "error");
    }
    setActionId(null);
  };

  const handleDeleteForever = async (id: string) => {
    if (!confirm("Delete permanently? This cannot be undone.")) return;
    setActionId(id);
    try {
      const r = await fetch(`/api/supasifieds/listings/${id}?permanent=true`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (d.success) {
        showToast("Permanently deleted");
        setArchivedListings((prev) => prev.filter((l) => l.id !== id));
      } else showToast(d.error ?? "Failed", "error");
    } catch {
      showToast("Something went wrong", "error");
    }
    setActionId(null);
  };

  const filtered = filter === "all" ? listings : listings.filter((l) => l.status === filter);

  if (!user) return null;

  return (
    <div className={styles.page}>
      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>
          {toast.msg}
        </div>
      )}

      <div className={styles.topBar}>
        <button type="button" className={styles.iconBtn} onClick={() => router.back()} aria-label="Back">
          ←
        </button>
        <div className={styles.topBarCenter}>
          <h1 className={styles.title}>My ads</h1>
          <p className={styles.subtitle}>Supasifieds · manage &amp; boost with SC</p>
          <Link href="/supasifieds" className={styles.sellerHubLink}>
            📋 Browse Supasifieds
          </Link>
          <Link href="/supasifieds/carousel" className={styles.sellerHubLink}>
            🎠 Create Carousel Ad
          </Link>
        </div>
        <Link href="/supasifieds/create" className={styles.iconBtn} aria-label="Create">
          ＋
        </Link>
      </div>

      <div className={styles.content}>
        <div className={styles.statsCard}>
          {(["all", "active", "paused"] as const).map((s) => {
            const count = s === "all" ? listings.length : listings.filter((l) => l.status === s).length;
            return (
              <button
                key={s}
                type="button"
                className={`${styles.statBtn} ${filter === s ? styles.statBtnActive : ""}`}
                onClick={() => setFilter(s)}
              >
                <span className={styles.statNum}>{count}</span>
                <span className={styles.statLabel}>
                  {s === "all" ? "All" : s === "active" ? "Active" : "Paused"}
                </span>
              </button>
            );
          })}
        </div>

        <div className={styles.archivedSection}>
          <button
            type="button"
            className={styles.archivedToggle}
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
          >
            <span className={styles.archivedToggleIcon}>{showArchived ? "▼" : "▶"}</span>
            <span>Archived / deleted</span>
            {!showArchived && archivedListings.length > 0 && (
              <span className={styles.archivedCount}>({archivedListings.length})</span>
            )}
          </button>
          {showArchived && (
            <div className={styles.archivedBody}>
              {archivedLoading ? (
                <div className={styles.archivedEmpty}>Loading...</div>
              ) : archivedListings.length === 0 ? (
                <div className={styles.archivedEmpty}>No records.</div>
              ) : (
                archivedListings.map((listing) => {
                  const st = String(listing.status ?? "");
                  const meta = STATUS_META[st] ?? STATUS_META.removed;
                  const statusClass = STATUS_CLASS[st] ?? styles.statusArchived;
                  return (
                    <div key={String(listing.id)} className={styles.listingRow}>
                      <Link href={`/supasifieds/${listing.id}`} className={styles.listingImg}>
                        {listing.images && Array.isArray(listing.images) && (listing.images as string[])[0] ? (
                          <img src={(listing.images as string[])[0]} alt="" className={styles.listingImgEl} />
                        ) : (
                          <span>📋</span>
                        )}
                      </Link>
                      <div className={styles.listingInfo}>
                        <div className={styles.listingTitle}>{String(listing.title ?? "")}</div>
                        <div className={styles.listingMeta}>
                          <span className={styles.listingPrice}>{formatPiPriceDisplay(String(listing.price_display ?? ""))}</span>
                          <span className={`${styles.statusBadge} ${statusClass}`}>{meta.label}</span>
                        </div>
                      </div>
                      <div className={styles.listingActions}>
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnRestore}`}
                          disabled={actionId === listing.id}
                          onClick={() => handleStatusChange(String(listing.id), "active")}
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                          disabled={actionId === listing.id}
                          onClick={() => handleDeleteForever(String(listing.id))}
                        >
                          Delete forever
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className={styles.body}>
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className={styles.skeletonCard}>
                <div className={styles.skeletonImage} />
                <div className={styles.skeletonLines}>
                  <div className={styles.skeletonLineLg} />
                  <div className={styles.skeletonLineMd} />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📋</div>
              <div className={styles.emptyTitle}>{listings.length === 0 ? "No ads yet" : "Nothing in this filter"}</div>
              <div className={styles.emptyDesc}>Post for free — boost with SupaCredits.</div>
              <div className={styles.emptyActions}>
                <button type="button" className={styles.secondaryBtn} onClick={() => router.back()}>
                  Back
                </button>
                <Link href="/supasifieds/create" className={styles.emptyBtn}>
                  + Post ad
                </Link>
              </div>
            </div>
          ) : (
            filtered.map((listing) => {
              const st = String(listing.status ?? "");
              const meta = STATUS_META[st] ?? STATUS_META.active;
              const boostExpiryIso = typeof listing.boost_expires_at === "string" ? listing.boost_expires_at : "";
              const isBoost = Boolean(listing.is_boosted) && Boolean(boostExpiryIso) && new Date(boostExpiryIso) > new Date();
              const statusClass = STATUS_CLASS[st] ?? styles.statusActive;
              return (
                <div key={String(listing.id)} className={styles.listingRow}>
                  <Link href={`/supasifieds/${listing.id}`} className={styles.listingImg}>
                    {listing.images && Array.isArray(listing.images) && (listing.images as string[])[0] ? (
                      <img src={(listing.images as string[])[0]} alt="" className={styles.listingImgEl} />
                    ) : (
                      <span>📋</span>
                    )}
                    {isBoost && <span className={styles.boostIndicator}>🚀</span>}
                  </Link>
                  <div className={styles.listingInfo}>
                    <div className={styles.listingTitle}>{String(listing.title ?? "")}</div>
                    <div className={styles.listingMeta}>
                      <span className={styles.listingPrice}>{formatPiPriceDisplay(String(listing.price_display ?? ""))}</span>
                      <span className={`${styles.statusBadge} ${statusClass}`}>{meta.label}</span>
                    </div>
                    <div className={styles.listingCategory}>
                      {(formatListingCategoryPath(
                        String(listing.category ?? ""),
                        String(listing.subcategory ?? ""),
                        listing.category_deep as string | undefined
                      ) || "General")}{" "}
                      · {timeAgo(String(listing.created_at ?? ""))}
                    </div>
                    <div className={styles.escrowBanner}>No escrow — buyers contact you directly</div>
                    <div className={styles.listingStats}>
                      <span>👁 {Number(listing.views ?? 0)}</span>
                      {isBoost && (
                        <span className={styles.boostExpiry}>
                          🚀 until{" "}
                          {new Date(String(listing.boost_expires_at)).toLocaleString([], {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={styles.listingActions}>
                    {st === "active" && (
                      <>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          title="Boost"
                          onClick={() =>
                            setBoostListing({
                              id: String(listing.id),
                              title: String(listing.title ?? ""),
                              image: (listing.images as string[])?.[0],
                              priceLabel: formatPiPriceDisplay(String(listing.price_display ?? ""), ""),
                            })
                          }
                        >
                          🚀
                        </button>
                        <Link href={`/supasifieds/${listing.id}/edit`} className={styles.actionBtn} title="Edit">
                          ✏️
                        </Link>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          title="Pause"
                          disabled={actionId === listing.id}
                          onClick={() => handleStatusChange(String(listing.id), "paused")}
                        >
                          ⏸
                        </button>
                      </>
                    )}
                    {st === "paused" && (
                      <button
                        type="button"
                        className={styles.actionBtn}
                        title="Activate"
                        disabled={actionId === listing.id}
                        onClick={() => handleStatusChange(String(listing.id), "active")}
                      >
                        ▶️
                      </button>
                    )}
                    {st !== "deleted" && (
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                        title="Delete"
                        disabled={actionId === listing.id}
                        onClick={() => {
                          if (confirm("Remove this ad?")) handleDeleteListing(String(listing.id));
                        }}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className={styles.stickyBuyBar}>
        <div className={styles.stickySummary}>
          <div className={styles.stickyLabel}>Active</div>
          <div className={styles.stickyValue}>{listings.filter((l) => l.status === "active").length}</div>
        </div>
        <Link href="/supasifieds/create" className={styles.stickyBuyBtn}>
          + New ad
        </Link>
      </div>

      {boostListing && (
        <div className={styles.boostOverlay} onClick={() => !boosting && !promoting && setBoostListing(null)}>
          <div className={styles.boostSheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.boostHeader}>
              <div className={styles.boostTitle}>📣 Promote ad</div>
              <button
                type="button"
                className={styles.boostClose}
                onClick={() => !boosting && !promoting && setBoostListing(null)}
              >
                ✕
              </button>
            </div>
            <div className={styles.boostBody}>
              <div className={styles.boostSummary}>
                <div className={styles.boostSummaryImage}>
                  {boostListing.image ? (
                    <img src={boostListing.image} alt="" className={styles.boostSummaryImageEl} />
                  ) : (
                    <span>📋</span>
                  )}
                </div>
                <div className={styles.boostSummaryInfo}>
                  <div className={styles.boostItem}>{boostListing.title}</div>
                  {boostListing.priceLabel ? (
                    <div className={styles.boostSummaryPrice}>{boostListing.priceLabel}</div>
                  ) : null}
                </div>
              </div>
              {scBalance != null && (
                <div className={styles.boostBalance}>
                  SC balance: <strong>{scBalance}</strong>
                </div>
              )}
              <div className={styles.boostTiers} style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                {[
                  ["boost", "🚀 Boost"],
                  ["spotlight", "⭐ Spotlight"],
                  ["autorepost", "🔁 Auto-repost"],
                  ["carousel", "🎠 Carousel"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`${styles.boostTier} ${promoteTab === id ? styles.boostTierActive : ""}`}
                    onClick={() => setPromoteTab(id as "boost" | "spotlight" | "autorepost" | "carousel")}
                  >
                    <span className={styles.boostTierLabel}>{label}</span>
                  </button>
                ))}
              </div>

              {promoteTab === "boost" && (
                <>
                  <div className={styles.boostStepTitle}>Choose a tier</div>
                  <div className={styles.boostTiers}>
                    {(Object.entries(CLASSIFIED_BOOST_TIERS) as [string, { sc: number; hrs: number; label: string }][]).map(
                      ([tier, info]) => (
                        <button
                          key={tier}
                          type="button"
                          className={`${styles.boostTier} ${boostTier === tier ? styles.boostTierActive : ""}`}
                          onClick={() => setBoostTier(tier)}
                          disabled={scBalance != null && scBalance < info.sc}
                        >
                          <span className={styles.boostTierLabel}>{info.label}</span>
                          <span className={styles.boostTierSc}>{info.sc} SC</span>
                        </button>
                      )
                    )}
                  </div>
                  <button
                    type="button"
                    className={styles.boostBtn}
                    disabled={!boostTier || boosting}
                    onClick={handleBoost}
                  >
                    {boosting ? "..." : `Boost ${boostTier ? CLASSIFIED_BOOST_TIERS[boostTier].sc : 0} SC`}
                  </button>
                </>
              )}

              {promoteTab === "spotlight" && (
                <>
                  <div className={styles.boostStepTitle}>Category spotlight duration</div>
                  <div className={styles.boostTiers}>
                    {[
                      { d: 3, sc: 120 },
                      { d: 7, sc: 250 },
                      { d: 14, sc: 450 },
                    ].map((opt) => (
                      <button
                        key={opt.d}
                        type="button"
                        className={`${styles.boostTier} ${spotlightDays === opt.d ? styles.boostTierActive : ""}`}
                        onClick={() => setSpotlightDays(opt.d)}
                        disabled={scBalance != null && scBalance < opt.sc}
                      >
                        <span className={styles.boostTierLabel}>{opt.d} days</span>
                        <span className={styles.boostTierSc}>{opt.sc} SC</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" className={styles.boostBtn} disabled={promoting} onClick={handleSpotlight}>
                    {promoting ? "..." : "Activate spotlight"}
                  </button>
                </>
              )}

              {promoteTab === "autorepost" && (
                <>
                  <div className={styles.boostStepTitle}>Auto-repost package</div>
                  <div className={styles.boostTiers}>
                    {[
                      { id: "24h_7d", label: "Every 24h / 7d", sc: 120 },
                      { id: "12h_7d", label: "Every 12h / 7d", sc: 200 },
                      { id: "6h_14d", label: "Every 6h / 14d", sc: 420 },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`${styles.boostTier} ${autorepostPkg === opt.id ? styles.boostTierActive : ""}`}
                        onClick={() => setAutorepostPkg(opt.id)}
                        disabled={scBalance != null && scBalance < opt.sc}
                      >
                        <span className={styles.boostTierLabel}>{opt.label}</span>
                        <span className={styles.boostTierSc}>{opt.sc} SC</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" className={styles.boostBtn} disabled={promoting} onClick={handleAutoRepost}>
                    {promoting ? "..." : "Activate auto-repost"}
                  </button>
                </>
              )}

              {promoteTab === "carousel" && (
                <>
                  <div className={styles.boostStepTitle}>Carousel ad setup</div>
                  <input
                    className={styles.input}
                    value={carouselHeadline}
                    onChange={(e) => setCarouselHeadline(e.target.value)}
                    placeholder="Headline (optional)"
                  />
                  <div className={styles.boostTiers}>
                    {[
                      { d: 3, sc: 180 },
                      { d: 7, sc: 360 },
                      { d: 14, sc: 650 },
                    ].map((opt) => (
                      <button
                        key={opt.d}
                        type="button"
                        className={`${styles.boostTier} ${carouselDays === opt.d ? styles.boostTierActive : ""}`}
                        onClick={() => setCarouselDays(opt.d)}
                        disabled={scBalance != null && scBalance < opt.sc}
                      >
                        <span className={styles.boostTierLabel}>{opt.d} days</span>
                        <span className={styles.boostTierSc}>{opt.sc} SC</span>
                      </button>
                    ))}
                  </div>
                  {!boostListing.image && (
                    <div className={styles.boostBalance}>Add at least 1 image to this listing before running carousel ads.</div>
                  )}
                  <button
                    type="button"
                    className={styles.boostBtn}
                    disabled={promoting || !boostListing.image}
                    onClick={handleCarousel}
                  >
                    {promoting ? "..." : "Launch carousel ad"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
