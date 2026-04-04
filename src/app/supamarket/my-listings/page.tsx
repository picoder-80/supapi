"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import { formatListingCategoryPath } from "@/lib/market/categories";

const BOOST_TIERS: Record<string, { sc: number; hrs: number; label: string }> = {
  bronze: { sc: 100, hrs: 24,  label: "🥉 Bronze · 24h" },
  silver: { sc: 250, hrs: 48,  label: "🥈 Silver · 48h" },
  gold:   { sc: 500, hrs: 72,  label: "👑 Gold · 72h"   },
};

type CarouselPackageConfig = { days: number; sc: number; label: string };
type SpotlightPackageConfig = { days: number; sc: number; label: string };
type AutoRepostPackageConfig = { id: string; interval_hours: number; days: number; sc: number; label: string };

const DEFAULT_CAROUSEL_PACKAGES: CarouselPackageConfig[] = [
  { days: 3, sc: 180, label: "3 days carousel ad" },
  { days: 7, sc: 360, label: "7 days carousel ad" },
  { days: 14, sc: 650, label: "14 days carousel ad" },
];
const DEFAULT_SPOTLIGHT_PACKAGES: SpotlightPackageConfig[] = [
  { days: 3, sc: 120, label: "3 days category spotlight" },
  { days: 7, sc: 250, label: "7 days category spotlight" },
  { days: 14, sc: 450, label: "14 days category spotlight" },
];
const DEFAULT_AUTOREPOST_PACKAGES: AutoRepostPackageConfig[] = [
  { id: "24h_7d", interval_hours: 24, days: 7, sc: 120, label: "Every 24h / 7d" },
  { id: "12h_7d", interval_hours: 12, days: 7, sc: 200, label: "Every 12h / 7d" },
  { id: "6h_14d", interval_hours: 6, days: 14, sc: 420, label: "Every 6h / 14d" },
];

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d === 0 ? "Today" : d === 1 ? "Yesterday" : `${d}d ago`;
}

function formatBoostExpiry(iso: string) {
  return new Date(iso).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active:  { label: "Active",  color: "#276749", bg: "#F0FFF4" },
  paused:  { label: "Paused",  color: "#744210", bg: "#FFFAF0" },
  sold:    { label: "Sold",    color: "#2D3748", bg: "#EDF2F7" },
  deleted: { label: "Deleted", color: "#9B2335", bg: "#FFF5F5" },
  removed: { label: "Archived", color: "#4A5568", bg: "#EDF2F7" },
};

const STATUS_CLASS: Record<string, string> = {
  active: styles.statusActive,
  paused: styles.statusPaused,
  sold: styles.statusSold,
  deleted: styles.statusDeleted,
  removed: styles.statusArchived,
};

export default function MyListingsPage() {
  const { user }  = useAuth();
  const router    = useRouter();

  const [listings, setListings] = useState<any[]>([]);
  const [archivedListings, setArchivedListings] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [filter, setFilter]     = useState<"all"|"active"|"paused"|"sold">("all");
  const [toast, setToast]       = useState<{ msg: string; type: "success"|"error" }|null>(null);
  const [actionId, setActionId] = useState<string|null>(null);
  const [boostListing, setBoostListing] = useState<{ id: string; title: string; image?: string; pricePi?: number } | null>(null);
  const [boostTier, setBoostTier]       = useState<string>("");
  const [boosting, setBoosting]         = useState(false);
  const [scBalance, setScBalance]       = useState<number | null>(null);
  const [promoteTab, setPromoteTab]     = useState<"boost" | "spotlight" | "autorepost" | "carousel">("boost");
  const [spotlightDays, setSpotlightDays] = useState(7);
  const [autorepostPkg, setAutorepostPkg] = useState("24h_7d");
  const [carouselDays, setCarouselDays] = useState(7);
  const [carouselHeadline, setCarouselHeadline] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [carouselPackages, setCarouselPackages] = useState<CarouselPackageConfig[]>(DEFAULT_CAROUSEL_PACKAGES);
  const [spotlightPackages, setSpotlightPackages] = useState<SpotlightPackageConfig[]>(DEFAULT_SPOTLIGHT_PACKAGES);
  const [autorepostPackages, setAutorepostPackages] = useState<AutoRepostPackageConfig[]>(DEFAULT_AUTOREPOST_PACKAGES);

  const token = () => typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "";

  const showToast = (msg: string, type: "success"|"error" = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500);
  };

  const fetchListings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await fetch("/api/supamarket/listings/mine", {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const d = await r.json();
      if (d.success) setListings(d.data ?? []);
    } catch {}
    setLoading(false);
  }, [user]);

  const fetchArchivedListings = useCallback(async () => {
    if (!user) return;
    setArchivedLoading(true);
    try {
      const r = await fetch("/api/supamarket/listings/mine?archived=true", {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const d = await r.json();
      if (d.success) setArchivedListings(d.data ?? []);
    } catch {}
    setArchivedLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) { router.push("/dashboard"); return; }
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
    } catch {}
  }, []);

  useEffect(() => { if (user) fetchScBalance(); }, [user, fetchScBalance]);

  useEffect(() => {
    fetch("/api/supamarket/promote/config")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.success || !d.data) return;
        if (Array.isArray(d.data.carouselPackages) && d.data.carouselPackages.length) {
          setCarouselPackages(d.data.carouselPackages);
          const hasCurrent = d.data.carouselPackages.some((x: CarouselPackageConfig) => x.days === carouselDays);
          if (!hasCurrent) setCarouselDays(d.data.carouselPackages[0].days);
        }
        if (Array.isArray(d.data.spotlightPackages) && d.data.spotlightPackages.length) {
          setSpotlightPackages(d.data.spotlightPackages);
          const hasCurrent = d.data.spotlightPackages.some((x: SpotlightPackageConfig) => x.days === spotlightDays);
          if (!hasCurrent) setSpotlightDays(d.data.spotlightPackages[0].days);
        }
        if (Array.isArray(d.data.autorepostPackages) && d.data.autorepostPackages.length) {
          setAutorepostPackages(d.data.autorepostPackages);
          const hasCurrent = d.data.autorepostPackages.some((x: AutoRepostPackageConfig) => x.id === autorepostPkg);
          if (!hasCurrent) setAutorepostPkg(d.data.autorepostPackages[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const handleBoost = async () => {
    if (!boostListing || !boostTier || !BOOST_TIERS[boostTier]) return;
    const t = token();
    if (!t) return;
    setBoosting(true);
    try {
      const r = await fetch("/api/supamarket/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ listing_id: boostListing.id, tier: boostTier }),
      });
      const d = await r.json();
      if (d.success) {
        showToast(`Boosted! ${BOOST_TIERS[boostTier].label}`);
        setBoostListing(null);
        setBoostTier("");
        setPromoteTab("boost");
        fetchListings();
        fetchScBalance();
      } else {
        showToast(d.error ?? "Boost failed", "error");
      }
    } catch { showToast("Something went wrong", "error"); }
    setBoosting(false);
  };

  const handleStatusChange = async (id: string, status: string) => {
    setActionId(id);
    try {
      const r = await fetch(`/api/supamarket/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ status }),
      });
      const d = await r.json();
      if (d.success) {
        showToast(`Listing ${status === "deleted" ? "deleted" : status === "paused" ? "paused" : "activated"}!`);
        fetchListings();
        if (showArchived) fetchArchivedListings();
      } else {
        showToast(d.error ?? "Update failed", "error");
      }
    } catch { showToast("Something went wrong", "error"); }
    setActionId(null);
  };

  const handleSpotlight = async () => {
    if (!boostListing) return;
    const t = token();
    if (!t) return;
    setPromoting(true);
    try {
      const r = await fetch("/api/supamarket/promote/spotlight", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ listing_id: boostListing.id, duration_days: spotlightDays }),
      });
      const d = await r.json();
      if (d.success) {
        showToast("Category spotlight activated");
        fetchListings();
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
      const r = await fetch("/api/supamarket/promote/autorepost", {
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
    setPromoting(true);
    try {
      const r = await fetch("/api/supamarket/promote/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({
          listing_id: boostListing.id,
          image_url: boostListing.image || "",
          headline: (carouselHeadline || boostListing.title).trim(),
          cta_label: "View Listing",
          link_url: `/supamarket/${boostListing.id}`,
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

  const handleDeleteListing = async (id: string) => {
    setActionId(id);
    try {
      const r = await fetch(`/api/supamarket/listings/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (d.success) {
        showToast("Listing deleted!");
        setListings(prev => prev.filter(l => l.id !== id));
      } else {
        showToast(d.error ?? "Delete failed", "error");
      }
    } catch {
      showToast("Something went wrong", "error");
    }
    setActionId(null);
  };

  const handleDeleteForever = async (id: string) => {
    if (!confirm("Delete this listing permanently? This cannot be undone.")) return;
    setActionId(id);
    try {
      const r = await fetch(`/api/supamarket/listings/${id}?permanent=true`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (d.success) {
        showToast("Listing permanently deleted");
        setArchivedListings(prev => prev.filter(l => l.id !== id));
      } else {
        showToast(d.error ?? "Delete failed", "error");
      }
    } catch {
      showToast("Something went wrong", "error");
    }
    setActionId(null);
  };

  const filtered = filter === "all" ? listings : listings.filter(l => l.status === filter);

  if (!user) return null;

  return (
    <div className={styles.page}>
      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>
          {toast.msg}
        </div>
      )}

      <div className={styles.topBar}>
        <button className={styles.iconBtn} onClick={() => router.back()} aria-label="Go back">←</button>
        <div className={styles.topBarCenter}>
          <h1 className={styles.title}>My Listings</h1>
          <p className={styles.subtitle}>Manage, boost, and track your products</p>
        </div>
        <Link href="/supamarket/create" className={styles.iconBtn} aria-label="Create listing">＋</Link>
      </div>

      <div className={styles.content}>
        <div className={styles.statsCard}>
          <div className={styles.statsIntro}>
            <div className={styles.statsIntroHead}>
              <h2 className={styles.statsIntroTitle}>My Market Listings</h2>
              <Link href="/supamarket/seller" className={styles.statsIntroCta}>
                Seller Hub
              </Link>
            </div>
            <p className={styles.statsIntroSub}>
              Manage your active, paused, sold, archived, and boost listings in one place.
            </p>
          </div>
          {(["all","active","paused","sold"] as const).map(s => {
            const count = s === "all" ? listings.length : listings.filter(l => l.status === s).length;
            return (
              <button
                key={s}
                className={`${styles.statBtn} ${filter === s ? styles.statBtnActive : ""}`}
                onClick={() => setFilter(s)}
              >
                <span className={styles.statNum}>{count}</span>
                <span className={styles.statLabel}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.archivedSection}>
          <button
            className={styles.archivedToggle}
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
          >
            <span className={styles.archivedToggleIcon}>{showArchived ? "▼" : "▶"}</span>
            <span>Archived / Removed listings</span>
            {!showArchived && archivedListings.length > 0 && (
              <span className={styles.archivedCount}>({archivedListings.length})</span>
            )}
          </button>
          {showArchived && (
            <div className={styles.archivedBody}>
              {archivedLoading ? (
                [...Array(2)].map((_, i) => (
                  <div key={i} className={styles.skeletonCard}>
                    <div className={styles.skeletonImage} />
                    <div className={styles.skeletonLines}>
                      <div className={styles.skeletonLineLg} />
                      <div className={styles.skeletonLineMd} />
                      <div className={styles.skeletonLineSm} />
                    </div>
                  </div>
                ))
              ) : archivedListings.length === 0 ? (
                <div className={styles.archivedEmpty}>
                  No archived or removed listings.
                </div>
              ) : (
                archivedListings.map((listing) => {
                  const meta = STATUS_META[listing.status] ?? STATUS_META.removed;
                  const statusClass = STATUS_CLASS[listing.status] ?? styles.statusArchived;
                  return (
                    <div key={listing.id} className={styles.listingRow}>
                      <Link href={`/supamarket/${listing.id}`} className={styles.listingImg}>
                        {listing.images?.[0]
                          ? <img src={listing.images[0]} alt="" className={styles.listingImgEl} />
                          : <span>🛍️</span>
                        }
                      </Link>
                      <div className={styles.listingInfo}>
                        <div className={styles.listingTitle}>{listing.title}</div>
                        <div className={styles.listingMeta}>
                          <span className={styles.listingPrice}>{parseFloat(listing.price_pi).toFixed(2)} π</span>
                          <span className={`${styles.statusBadge} ${statusClass}`}>{meta.label}</span>
                        </div>
                        <div className={styles.listingCategory}>{(formatListingCategoryPath(listing.category ?? "", listing.subcategory ?? "", listing.category_deep) || "General")} · {timeAgo(listing.created_at)}</div>
                      </div>
                      <div className={styles.listingActions}>
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnRestore}`}
                          title="Restore"
                          disabled={actionId === listing.id}
                          onClick={() => handleStatusChange(listing.id, "active")}
                        >
                          ↩ Restore
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnDeleteForever}`}
                          title="Delete Forever"
                          disabled={actionId === listing.id}
                          onClick={() => handleDeleteForever(listing.id)}
                        >
                          🗑 Delete Forever
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
                  <div className={styles.skeletonLineSm} />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🛍️</div>
              <div className={styles.emptyTitle}>{listings.length === 0 ? "No listings yet" : "No listings in this filter"}</div>
              <div className={styles.emptyDesc}>Start selling to earn Pi and SC rewards.</div>
              <div className={styles.emptyActions}>
                <button className={styles.secondaryBtn} onClick={() => router.back()}>Back</button>
                <Link href="/supamarket/create" className={styles.emptyBtn}>Create Listing</Link>
              </div>
            </div>
          ) : (
            filtered.map(listing => {
              const meta    = STATUS_META[listing.status] ?? STATUS_META.active;
              const boostExpiryIso = typeof listing.boost_expires_at === "string" ? listing.boost_expires_at : "";
              const spotlightExpiryIso = typeof listing.spotlight_expires_at === "string" ? listing.spotlight_expires_at : "";
              const carouselExpiryIso = typeof listing.carousel_expires_at === "string" ? listing.carousel_expires_at : "";
              const isBoost = Boolean(listing.is_boosted) && Boolean(boostExpiryIso) && new Date(boostExpiryIso) > new Date();
              const isSpotlight = Boolean(spotlightExpiryIso) && new Date(spotlightExpiryIso) > new Date();
              const isCarousel = Boolean(carouselExpiryIso) && new Date(carouselExpiryIso) > new Date();
              const statusClass = STATUS_CLASS[listing.status] ?? styles.statusActive;
              return (
                <div key={listing.id} className={styles.listingRow}>
                  <Link href={`/supamarket/${listing.id}`} className={styles.listingImg}>
                    {listing.images?.[0]
                      ? <img src={listing.images[0]} alt="" className={styles.listingImgEl} />
                      : <span>🛍️</span>
                    }
                    <div className={styles.badgeStack}>
                      {isBoost && (
                        <div className={styles.boostBadge}>
                          {listing.boost_tier === "gold" ? "👑" : listing.boost_tier === "silver" ? "🥈" : "🥉"} Boost
                        </div>
                      )}
                      {isSpotlight && (
                        <div className={styles.spotlightBadge}>⭐ Spotlight</div>
                      )}
                      {isCarousel && (
                        <div className={styles.carouselBadge}>🎠 Carousel</div>
                      )}
                    </div>
                  </Link>

                  <div className={styles.listingInfo}>
                    <div className={styles.listingTitle}>{listing.title}</div>
                    <div className={styles.listingMeta}>
                      <span className={styles.listingPrice}>{parseFloat(listing.price_pi).toFixed(2)} π</span>
                      <span className={`${styles.statusBadge} ${statusClass}`}>{meta.label}</span>
                    </div>
                    <div className={styles.listingCategory}>{(formatListingCategoryPath(listing.category ?? "", listing.subcategory ?? "", listing.category_deep) || "General")} · {timeAgo(listing.created_at)}</div>
                    <div className={styles.escrowBanner}>π held in escrow until buyer confirms delivery</div>
                    <div className={styles.listingStats}>
                      <span>👁 {listing.views ?? 0}</span>
                      <span>❤️ {listing.likes ?? 0}</span>
                      <span>📦 {listing.stock ?? 0} left</span>
                      {isBoost && (
                        <span className={styles.boostExpiry}>
                          🚀 until {formatBoostExpiry(boostExpiryIso)}
                        </span>
                      )}
                      {isSpotlight && (
                        <span className={styles.spotlightExpiry}>
                          ⭐ Spotlight until {formatBoostExpiry(spotlightExpiryIso)}
                        </span>
                      )}
                      {isCarousel && (
                        <span className={styles.carouselExpiry}>
                          🎠 Carousel until {formatBoostExpiry(carouselExpiryIso)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={styles.listingActions}>
                    {listing.status === "active" && (
                      <>
                        {isBoost ? (
                          <button
                            className={styles.actionBtn}
                            title={`Boost active until ${formatBoostExpiry(boostExpiryIso)}`}
                            disabled
                          >
                            ✅
                          </button>
                        ) : (
                          <button
                            className={styles.actionBtn}
                            title="Boost"
                            onClick={() =>
                              setBoostListing({
                                id: listing.id,
                                title: listing.title,
                                image: listing.images?.[0],
                                pricePi: Number(listing.price_pi ?? 0),
                              })
                            }
                          >
                            🚀
                          </button>
                        )}
                        <Link href={`/supamarket/${listing.id}/edit`} className={styles.actionBtn} title="Edit">✏️</Link>
                        <button
                          className={styles.actionBtn}
                          title="Pause"
                          disabled={actionId === listing.id}
                          onClick={() => handleStatusChange(listing.id, "paused")}
                        >
                          ⏸
                        </button>
                      </>
                    )}
                    {listing.status === "paused" && (
                      <button
                        className={styles.actionBtn}
                        title="Activate"
                        disabled={actionId === listing.id}
                        onClick={() => handleStatusChange(listing.id, "active")}
                      >
                        ▶️
                      </button>
                    )}
                    {listing.status !== "deleted" && listing.status !== "sold" && (
                      <button
                        className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                        title="Delete"
                        disabled={actionId === listing.id}
                        onClick={() => { if (confirm("Delete this listing?")) handleDeleteListing(listing.id); }}
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
          <div className={styles.stickyLabel}>Total active</div>
          <div className={styles.stickyValue}>{listings.filter((l) => l.status === "active").length}</div>
        </div>
        <Link href="/supamarket/create" className={styles.stickyBuyBtn}>Create New Listing</Link>
      </div>

      {/* Boost modal */}
      {boostListing && (
        <div className={styles.boostOverlay} onClick={() => !boosting && !promoting && setBoostListing(null)}>
          <div className={styles.boostSheet} onClick={e => e.stopPropagation()}>
            <div className={styles.boostHeader}>
              <div className={styles.boostTitle}>📣 Promote ad</div>
              <button
                className={styles.boostClose}
                onClick={() => {
                  if (boosting || promoting) return;
                  setBoostListing(null);
                  setPromoteTab("boost");
                }}
              >
                ✕
              </button>
            </div>
            <div className={styles.boostBody}>
              <div className={styles.boostSummary}>
                <div className={styles.boostSummaryImage}>
                  {boostListing.image ? <img src={boostListing.image} alt="" className={styles.boostSummaryImageEl} /> : <span>🛍️</span>}
                </div>
                <div className={styles.boostSummaryInfo}>
                  <div className={styles.boostItem}>{boostListing.title}</div>
                  {typeof boostListing.pricePi === "number" && Number.isFinite(boostListing.pricePi) && (
                    <div className={styles.boostSummaryPrice}>{boostListing.pricePi.toFixed(2)} π</div>
                  )}
                </div>
              </div>
              {scBalance != null && <div className={styles.boostBalance}>Your SC Balance: <strong>{scBalance}</strong></div>}
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
              <div className={styles.boostBalance}>
                {promoteTab === "boost" && "Boost lifts your listing priority for a limited time so it appears higher in results."}
                {promoteTab === "spotlight" && "Category spotlight for SupaMarket is coming soon."}
                {promoteTab === "autorepost" && "Auto-repost for SupaMarket is coming soon."}
                {promoteTab === "carousel" && "Carousel ads for SupaMarket is coming soon."}
              </div>

              {promoteTab === "boost" && (
                <>
                  <div className={styles.boostStepTitle}>Select boost tier</div>
                  <div className={styles.boostTiers}>
                    {(Object.entries(BOOST_TIERS) as [string, { sc: number; hrs: number; label: string }][]).map(([tier, info]) => (
                      <button
                        key={tier}
                        className={`${styles.boostTier} ${boostTier === tier ? styles.boostTierActive : ""}`}
                        onClick={() => setBoostTier(tier)}
                        disabled={scBalance != null && scBalance < info.sc}
                      >
                        <span className={styles.boostTierLabel}>{info.label}</span>
                        <span className={styles.boostTierSc}>{info.sc} SC</span>
                      </button>
                    ))}
                  </div>
                  <button className={styles.boostBtn} disabled={!boostTier || boosting} onClick={handleBoost}>
                    {boosting ? "Processing..." : `Boost for ${boostTier ? BOOST_TIERS[boostTier].sc : 0} SC`}
                  </button>
                </>
              )}

              {promoteTab === "spotlight" && (
                <>
                  <div className={styles.boostStepTitle}>Category spotlight duration</div>
                  <div className={styles.boostTiers}>
                    {spotlightPackages.map((opt) => (
                      <button
                        key={opt.days}
                        type="button"
                        className={`${styles.boostTier} ${spotlightDays === opt.days ? styles.boostTierActive : ""}`}
                        onClick={() => setSpotlightDays(opt.days)}
                        disabled={scBalance != null && scBalance < opt.sc}
                      >
                        <span className={styles.boostTierLabel}>{opt.days} days</span>
                        <span className={styles.boostTierSc}>{opt.sc} SC</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" className={styles.boostBtn} disabled={promoting} onClick={handleSpotlight}>
                    {promoting ? "Processing..." : "Activate spotlight"}
                  </button>
                </>
              )}

              {promoteTab === "autorepost" && (
                <>
                  <div className={styles.boostStepTitle}>Auto-repost package</div>
                  <div className={styles.boostTiers}>
                    {autorepostPackages.map((opt) => (
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
                    {promoting ? "Processing..." : "Activate auto-repost"}
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
                    {carouselPackages.map((opt) => (
                      <button
                        key={opt.days}
                        type="button"
                        className={`${styles.boostTier} ${carouselDays === opt.days ? styles.boostTierActive : ""}`}
                        onClick={() => setCarouselDays(opt.days)}
                        disabled={scBalance != null && scBalance < opt.sc}
                      >
                        <span className={styles.boostTierLabel}>{opt.days} days</span>
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
                    {promoting ? "Processing..." : "Launch carousel ad"}
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
