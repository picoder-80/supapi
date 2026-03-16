"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

const BOOST_TIERS: Record<string, { sc: number; hrs: number; label: string }> = {
  bronze: { sc: 100, hrs: 24,  label: "Bronze - 24h" },
  silver: { sc: 250, hrs: 48,  label: "Silver - 48h" },
  gold:   { sc: 500, hrs: 72,  label: "Gold - 72h"   },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active:  { label: "Active",  color: "#276749", bg: "#F0FFF4" },
  paused:  { label: "Paused",  color: "#744210", bg: "#FFFAF0" },
  sold:    { label: "Sold",    color: "#2D3748", bg: "#EDF2F7" },
  deleted: { label: "Deleted", color: "#9B2335", bg: "#FFF5F5" },
};

export default function MyListingsPage() {
  const { user }  = useAuth();
  const router    = useRouter();

  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<"all"|"active"|"paused"|"sold">("all");
  const [toast, setToast]       = useState<{ msg: string; type: "success"|"error" }|null>(null);
  const [actionId, setActionId] = useState<string|null>(null);
  const [boostListing, setBoostListing] = useState<{ id: string; title: string } | null>(null);
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

  useEffect(() => {
    if (!user) { router.push("/dashboard"); return; }
    fetchListings();
  }, [user, fetchListings, router]);

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
      } else {
        showToast(d.error ?? "Update failed", "error");
      }
    } catch { showToast("Something went wrong", "error"); }
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

      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <h1 className={styles.title}>My Listings</h1>
        <Link href="/supamarket/create" className={styles.createBtn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New
        </Link>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        {(["all","active","paused","sold"] as const).map(s => {
          const count = s === "all" ? listings.length : listings.filter(l => l.status === s).length;
          return (
            <button key={s} className={`${styles.statBtn} ${filter === s ? styles.statBtnActive : ""}`}
              onClick={() => setFilter(s)}>
              <span className={styles.statNum}>{count}</span>
              <span className={styles.statLabel}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className={styles.body}>
        {loading ? (
          [...Array(4)].map((_, i) => <div key={i} className={styles.skeletonRow} />)
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </div>
            <div className={styles.emptyTitle}>No listings yet</div>
            <div className={styles.emptyDesc}>Start selling to earn Pi and SC rewards!</div>
            <Link href="/supamarket/create" className={styles.emptyBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Create First Listing
            </Link>
          </div>
        ) : (
          filtered.map(listing => {
            const meta    = STATUS_META[listing.status] ?? STATUS_META.active;
            const isBoost = listing.is_boosted && listing.boost_expires_at && new Date(listing.boost_expires_at) > new Date();
            return (
              <div key={listing.id} className={styles.listingRow}>
                <Link href={`/supamarket/${listing.id}`} className={styles.listingImg}>
                  {listing.images?.[0]
                    ? <img src={listing.images[0]} alt="" className={styles.listingImgEl} />
                    : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                        <line x1="3" y1="6" x2="21" y2="6"/>
                        <path d="M16 10a4 4 0 0 1-8 0"/>
                      </svg>
                  }
                  {isBoost && <span className={styles.boostIndicator}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#0a1628" stroke="none">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                    </svg>
                  </span>}
                </Link>

                <div className={styles.listingInfo}>
                  <div className={styles.listingTitle}>{listing.title}</div>
                  <div className={styles.listingMeta}>
                    <span className={styles.listingPrice}>{parseFloat(listing.price_pi).toFixed(2)} Pi</span>
                    <span className={styles.statusBadge} style={{ color: meta.color, background: meta.bg }}>
                      {meta.label}
                    </span>
                  </div>
                  <div className={styles.listingStats}>
                    <span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      {listing.views ?? 0}
                    </span>
                    <span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444" stroke="none">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                      {listing.likes ?? 0}
                    </span>
                    <span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                      </svg>
                      {listing.stock ?? 0}
                    </span>
                    {isBoost && (
                      <span className={styles.boostExpiry}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#d4af37" stroke="none">
                          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                        </svg>
                        until {new Date(listing.boost_expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.listingActions}>
                  {listing.status === "active" && (
                    <>
                      <button className={styles.actionBtn} title="Boost" onClick={() => setBoostListing({ id: listing.id, title: listing.title })}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#d4af37" stroke="none">
                          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                        </svg>
                      </button>
                      <Link href={`/supamarket/${listing.id}/edit`} className={styles.actionBtn} title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </Link>
                      <button className={styles.actionBtn} title="Pause"
                        disabled={actionId === listing.id}
                        onClick={() => handleStatusChange(listing.id, "paused")}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="6" y="4" width="4" height="16"/>
                          <rect x="14" y="4" width="4" height="16"/>
                        </svg>
                      </button>
                    </>
                  )}
                  {listing.status === "paused" && (
                    <button className={styles.actionBtn} title="Activate"
                      disabled={actionId === listing.id}
                      onClick={() => handleStatusChange(listing.id, "active")}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                    </button>
                  )}
                  {listing.status !== "deleted" && listing.status !== "sold" && (
                    <button className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                      title="Delete" disabled={actionId === listing.id}
                      onClick={() => { if (confirm("Delete this listing?")) handleStatusChange(listing.id, "deleted"); }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Boost modal */}
      {boostListing && (
        <div className={styles.boostOverlay} onClick={() => !boosting && setBoostListing(null)}>
          <div className={styles.boostSheet} onClick={e => e.stopPropagation()}>
            <div className={styles.boostHeader}>
              <div className={styles.boostTitle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#d4af37" stroke="none" style={{ marginRight: 8 }}>
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
                Boost Listing
              </div>
              <button className={styles.boostClose} onClick={() => !boosting && setBoostListing(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className={styles.boostBody}>
              <div className={styles.boostItem}>{boostListing.title}</div>
              {scBalance != null && <div className={styles.boostBalance}>Your SC: <strong>{scBalance}</strong></div>}
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
