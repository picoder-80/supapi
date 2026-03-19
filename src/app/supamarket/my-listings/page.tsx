"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

const BOOST_TIERS: Record<string, { sc: number; hrs: number; label: string }> = {
  bronze: { sc: 100, hrs: 24,  label: "🥉 Bronze · 24h" },
  silver: { sc: 250, hrs: 48,  label: "🥈 Silver · 48h" },
  gold:   { sc: 500, hrs: 72,  label: "👑 Gold · 72h"   },
};

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d === 0 ? "Today" : d === 1 ? "Yesterday" : `${d}d ago`;
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
                        <div className={styles.listingCategory}>{listing.category ?? "General"} · {timeAgo(listing.created_at)}</div>
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
              const isBoost = listing.is_boosted && listing.boost_expires_at && new Date(listing.boost_expires_at) > new Date();
              const statusClass = STATUS_CLASS[listing.status] ?? styles.statusActive;
              return (
                <div key={listing.id} className={styles.listingRow}>
                  <Link href={`/supamarket/${listing.id}`} className={styles.listingImg}>
                    {listing.images?.[0]
                      ? <img src={listing.images[0]} alt="" className={styles.listingImgEl} />
                      : <span>🛍️</span>
                    }
                    {isBoost && <span className={styles.boostIndicator}>🚀</span>}
                  </Link>

                  <div className={styles.listingInfo}>
                    <div className={styles.listingTitle}>{listing.title}</div>
                    <div className={styles.listingMeta}>
                      <span className={styles.listingPrice}>{parseFloat(listing.price_pi).toFixed(2)} π</span>
                      <span className={`${styles.statusBadge} ${statusClass}`}>{meta.label}</span>
                    </div>
                    <div className={styles.listingCategory}>{listing.category ?? "General"} · {timeAgo(listing.created_at)}</div>
                    <div className={styles.escrowBanner}>π held in escrow until buyer confirms delivery</div>
                    <div className={styles.listingStats}>
                      <span>👁 {listing.views ?? 0}</span>
                      <span>❤️ {listing.likes ?? 0}</span>
                      <span>📦 {listing.stock ?? 0} left</span>
                      {isBoost && (
                        <span className={styles.boostExpiry}>
                          🚀 until {new Date(listing.boost_expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={styles.listingActions}>
                    {listing.status === "active" && (
                      <>
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
        <div className={styles.boostOverlay} onClick={() => !boosting && setBoostListing(null)}>
          <div className={styles.boostSheet} onClick={e => e.stopPropagation()}>
            <div className={styles.boostHeader}>
              <div className={styles.boostTitle}>🚀 Boost Listing</div>
              <button className={styles.boostClose} onClick={() => !boosting && setBoostListing(null)}>✕</button>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
