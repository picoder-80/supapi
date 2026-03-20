"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePathname, useRouter } from "next/navigation";
import styles from "../../supamarket/my-listings/page.module.css";
import { formatListingCategoryPath as formatSupasifiedsCategoryPath } from "@/lib/supasifieds/categories";
import { formatListingCategoryPath as formatSupaautoCategoryPath } from "@/lib/supaauto/categories";
import { CLASSIFIED_BOOST_TIERS } from "@/lib/supasifieds/boost-tiers";
import { formatPiPriceDisplay } from "@/lib/supasifieds/price";

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

type BoostTierConfig = { sc: number; hrs: number; label: string };
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

export default function SupasifiedsMyListingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isSupaauto = pathname?.startsWith("/supaauto");
  const isSupadomus = pathname?.startsWith("/supadomus");
  const appBase = isSupaauto ? "/supaauto" : isSupadomus ? "/supadomus" : "/supasifieds";
  const apiBase = isSupaauto ? "/api/supaauto" : isSupadomus ? "/api/supadomus" : "/api/supasifieds";
  const formatListingCategoryPath = isSupaauto ? formatSupaautoCategoryPath : formatSupasifiedsCategoryPath;

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
  const [boostTiers, setBoostTiers] = useState<Record<string, BoostTierConfig>>(CLASSIFIED_BOOST_TIERS);
  const [carouselPackages, setCarouselPackages] = useState<CarouselPackageConfig[]>(DEFAULT_CAROUSEL_PACKAGES);
  const [spotlightPackages, setSpotlightPackages] = useState<SpotlightPackageConfig[]>(DEFAULT_SPOTLIGHT_PACKAGES);
  const [autorepostPackages, setAutorepostPackages] = useState<AutoRepostPackageConfig[]>(DEFAULT_AUTOREPOST_PACKAGES);
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
      const r = await fetch(`${apiBase}/listings/mine`, { headers: { Authorization: `Bearer ${token()}` } });
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
      const r = await fetch(`${apiBase}/listings/mine?archived=true`, {
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

  useEffect(() => {
    fetch(`${apiBase}/promote/config`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.boostTiers) setBoostTiers(d.data.boostTiers);
        if (d.success && Array.isArray(d.data?.carouselPackages) && d.data.carouselPackages.length) {
          setCarouselPackages(d.data.carouselPackages);
          const hasCurrent = d.data.carouselPackages.some((x: CarouselPackageConfig) => x.days === carouselDays);
          if (!hasCurrent) setCarouselDays(d.data.carouselPackages[0].days);
        }
        if (d.success && Array.isArray(d.data?.spotlightPackages) && d.data.spotlightPackages.length) {
          setSpotlightPackages(d.data.spotlightPackages);
          const hasCurrent = d.data.spotlightPackages.some((x: SpotlightPackageConfig) => x.days === spotlightDays);
          if (!hasCurrent) setSpotlightDays(d.data.spotlightPackages[0].days);
        }
        if (d.success && Array.isArray(d.data?.autorepostPackages) && d.data.autorepostPackages.length) {
          setAutorepostPackages(d.data.autorepostPackages);
          const hasCurrent = d.data.autorepostPackages.some((x: AutoRepostPackageConfig) => x.id === autorepostPkg);
          if (!hasCurrent) setAutorepostPkg(d.data.autorepostPackages[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const handleBoost = async () => {
    if (!boostListing || !boostTier || !boostTiers[boostTier]) return;
    const t = token();
    if (!t) return;
    setBoosting(true);
    try {
      const r = await fetch(`${apiBase}/boost`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ classified_id: boostListing.id, tier: boostTier }),
      });
      const d = await r.json();
      if (d.success) {
        showToast(`Boost! ${boostTiers[boostTier].label}`);
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
      const r = await fetch(`${apiBase}/promote/spotlight`, {
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
      const r = await fetch(`${apiBase}/promote/autorepost`, {
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
    const linkUrl = `${appBase}/${boostListing.id}`;
    setPromoting(true);
    try {
      const r = await fetch(`${apiBase}/promote/carousel`, {
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
      const r = await fetch(`${apiBase}/listings/${id}`, {
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
      const r = await fetch(`${apiBase}/listings/${id}`, {
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
      const r = await fetch(`${apiBase}/listings/${id}?permanent=true`, {
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
          <p className={styles.subtitle}>{isSupaauto ? "SupaAuto" : isSupadomus ? "SupaDomus" : "Supasifieds"} · manage &amp; boost with SC</p>
          <Link href={appBase} className={styles.sellerHubLink}>
            📋 Browse {isSupaauto ? "SupaAuto" : isSupadomus ? "SupaDomus" : "Supasifieds"}
          </Link>
        </div>
        <Link href={`${appBase}/create`} className={styles.iconBtn} aria-label="Create">
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
          <Link href={`${appBase}/carousel`} className={styles.statBtn} aria-label="Create Carousel Ad">
            <span className={styles.statNum}>🎠</span>
            <span className={styles.statLabel}>Carousel Ad</span>
          </Link>
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
                      <Link href={`${appBase}/${listing.id}`} className={styles.listingImg}>
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
                <Link href={`${appBase}/create`} className={styles.emptyBtn}>
                  + Post ad
                </Link>
              </div>
            </div>
          ) : (
            filtered.map((listing) => {
              const st = String(listing.status ?? "");
              const meta = STATUS_META[st] ?? STATUS_META.active;
              const boostExpiryIso = typeof listing.boost_expires_at === "string" ? listing.boost_expires_at : "";
              const spotlightExpiryIso = typeof listing.spotlight_expires_at === "string" ? listing.spotlight_expires_at : "";
              const isBoost = Boolean(listing.is_boosted) && Boolean(boostExpiryIso) && new Date(boostExpiryIso) > new Date();
              const isSpotlight = Boolean(spotlightExpiryIso) && new Date(spotlightExpiryIso) > new Date();
              const statusClass = STATUS_CLASS[st] ?? styles.statusActive;
              return (
                <div key={String(listing.id)} className={styles.listingRow}>
                  <Link href={`${appBase}/${listing.id}`} className={styles.listingImg}>
                    {listing.images && Array.isArray(listing.images) && (listing.images as string[])[0] ? (
                      <img src={(listing.images as string[])[0]} alt="" className={styles.listingImgEl} />
                    ) : (
                      <span>📋</span>
                    )}
                    {isBoost && <span className={styles.boostIndicator}>🚀</span>}
                    {isSpotlight && <span className={styles.spotlightIndicator}>⭐</span>}
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
                      {isBoost && isSpotlight && (
                        <span className={styles.boostExpiry}>
                          🚀 Boost + ⭐ Spotlight active
                        </span>
                      )}
                      {isBoost && !isSpotlight && (
                        <span className={styles.boostExpiry}>
                          ⭐ Boost active
                        </span>
                      )}
                      {isSpotlight && !isBoost && (
                        <span className={styles.spotlightExpiry}>
                          ⭐ Spotlight active
                        </span>
                      )}
                      {isBoost && (
                        <span className={styles.boostExpiry}>
                          🚀 Boost until{" "}
                          {formatBoostExpiry(String(listing.boost_expires_at))}
                        </span>
                      )}
                      {isSpotlight && (
                        <span className={styles.spotlightExpiry}>
                          ⭐ Spotlight until {formatBoostExpiry(spotlightExpiryIso)}
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
                        <Link href={`${appBase}/${listing.id}/edit`} className={styles.actionBtn} title="Edit">
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
        <Link href={`${appBase}/create`} className={styles.stickyBuyBtn}>
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
              <div className={styles.boostBalance}>
                {promoteTab === "boost" && "Boost lifts your ad priority for a limited time so it appears higher in results."}
                {promoteTab === "spotlight" && "Spotlight highlights your ad in its category feed for stronger visibility."}
                {promoteTab === "autorepost" && "Auto-repost refreshes your ad on a schedule so it stays fresh without manual repost."}
                {promoteTab === "carousel" && "Carousel displays your ad in the sponsored slider banner with image and CTA."}
              </div>

              {promoteTab === "boost" && (
                <>
                  <div className={styles.boostStepTitle}>Choose a tier</div>
                  <div className={styles.boostTiers}>
                    {(Object.entries(boostTiers) as [string, { sc: number; hrs: number; label: string }][]).map(
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
                    {boosting ? "..." : `Boost ${boostTier ? boostTiers[boostTier]?.sc ?? 0 : 0} SC`}
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
                    {promoting ? "..." : "Activate spotlight"}
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
