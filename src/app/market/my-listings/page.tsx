"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d === 0 ? "Today" : d === 1 ? "Yesterday" : `${d}d ago`;
}

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

  const token = () => typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "";

  const showToast = (msg: string, type: "success"|"error" = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500);
  };

  const fetchListings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await fetch("/api/market/listings/mine", {
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

  const handleStatusChange = async (id: string, status: string) => {
    setActionId(id);
    try {
      const r = await fetch(`/api/market/listings/${id}`, {
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
        <button className={styles.backBtn} onClick={() => router.back()}>← Back</button>
        <h1 className={styles.title}>My Listings</h1>
        <Link href="/market/create" className={styles.createBtn}>+ New</Link>
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
            <div className={styles.emptyIcon}>🛍️</div>
            <div className={styles.emptyTitle}>No listings yet</div>
            <div className={styles.emptyDesc}>Start selling to earn Pi and SC rewards!</div>
            <Link href="/market/create" className={styles.emptyBtn}>+ Create First Listing</Link>
          </div>
        ) : (
          filtered.map(listing => {
            const meta    = STATUS_META[listing.status] ?? STATUS_META.active;
            const isBoost = listing.is_boosted && listing.boost_expires_at && new Date(listing.boost_expires_at) > new Date();
            return (
              <div key={listing.id} className={styles.listingRow}>
                <Link href={`/market/${listing.id}`} className={styles.listingImg}>
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
                    <span className={styles.statusBadge} style={{ color: meta.color, background: meta.bg }}>
                      {meta.label}
                    </span>
                  </div>
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
                      <Link href={`/market/${listing.id}`} className={styles.actionBtn} title="Boost">🚀</Link>
                      <button className={styles.actionBtn} title="Pause"
                        disabled={actionId === listing.id}
                        onClick={() => handleStatusChange(listing.id, "paused")}>⏸</button>
                    </>
                  )}
                  {listing.status === "paused" && (
                    <button className={styles.actionBtn} title="Activate"
                      disabled={actionId === listing.id}
                      onClick={() => handleStatusChange(listing.id, "active")}>▶️</button>
                  )}
                  {listing.status !== "deleted" && listing.status !== "sold" && (
                    <button className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                      title="Delete" disabled={actionId === listing.id}
                      onClick={() => { if (confirm("Delete this listing?")) handleStatusChange(listing.id, "deleted"); }}>🗑</button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
