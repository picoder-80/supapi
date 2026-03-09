"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./page.module.css";

interface Listing {
  id: string; title: string; price_pi: number; images: string[];
  category: string; status: string; stock: number; views: number; created_at: string;
}

const STATUS_LABELS: Record<string,{label:string;color:string;bg:string}> = {
  active:  { label:"Active",  color:"#27ae60", bg:"rgba(39,174,96,0.1)" },
  paused:  { label:"Paused",  color:"#f39c12", bg:"rgba(243,156,18,0.1)" },
  sold:    { label:"Sold",    color:"#7f8c8d", bg:"rgba(127,140,141,0.1)" },
  deleted: { label:"Deleted", color:"#e74c3c", bg:"rgba(231,76,60,0.1)" },
};

export default function MyListingsPage() {
  const { user } = useAuth();
  const router   = useRouter();
  const [listings, setListings]   = useState<Listing[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState("active");
  const [updating, setUpdating]   = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetch_ = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("supapi_token");
        const params = new URLSearchParams({ seller_id: user.id, status: filter === "all" ? "" : filter });
        // Re-use listings API but filter by seller via server
        const r = await fetch(`/api/market/my-listings?status=${filter}`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (d.success) setListings(d.data);
      } catch {}
      setLoading(false);
    };
    fetch_();
  }, [user, filter]);

  const toggleStatus = async (listing: Listing) => {
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    const newStatus = listing.status === "active" ? "paused" : "active";
    setUpdating(listing.id);
    try {
      const r = await fetch(`/api/market/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      const d = await r.json();
      if (d.success) setListings(prev => prev.map(l => l.id === listing.id ? { ...l, status: newStatus } : l));
    } catch {}
    setUpdating(null);
  };

  const deleteListing = async (id: string) => {
    if (!confirm("Delete this listing?")) return;
    const token = localStorage.getItem("supapi_token");
    if (!token) return;
    setUpdating(id);
    try {
      await fetch(`/api/market/listings/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setListings(prev => prev.filter(l => l.id !== id));
    } catch {}
    setUpdating(null);
  };

  if (!user) return (
    <div className={styles.authWall}>
      <div className={styles.authIcon}>🔒</div>
      <div className={styles.authTitle}>Sign in required</div>
      <button className={styles.authBtn} onClick={() => router.push("/dashboard")}>Sign In</button>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.push("/market")}>← Market</button>
        <h1 className={styles.title}>My Listings</h1>
        <Link href="/market/create" className={styles.createBtn}>+ New</Link>
      </div>

      <div className={styles.filters}>
        {["active","paused","all"].map(f => (
          <button key={f} className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ""}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className={styles.body}>
        {loading ? (
          <div className={styles.loadingList}>{[...Array(3)].map((_,i) => <div key={i} className={styles.skeleton} />)}</div>
        ) : listings.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🏪</div>
            <div className={styles.emptyTitle}>No {filter} listings</div>
            <Link href="/market/create" className={styles.emptyBtn}>+ Create Listing</Link>
          </div>
        ) : (
          <div className={styles.list}>
            {listings.map(l => {
              const st = STATUS_LABELS[l.status] ?? { label: l.status, color:"#999", bg:"#eee" };
              return (
                <div key={l.id} className={styles.card}>
                  <div className={styles.cardImg}>
                    {l.images?.[0] ? <img src={l.images[0]} alt="" className={styles.cardImgEl} /> : <div className={styles.cardImgPlaceholder}>🛍️</div>}
                  </div>
                  <div className={styles.cardInfo}>
                    <div className={styles.cardTitle}>{l.title}</div>
                    <div className={styles.cardPrice}>{Number(l.price_pi).toFixed(2)} π</div>
                    <div className={styles.cardMeta}>
                      <span className={styles.statusBadge} style={{ color: st.color, background: st.bg }}>{st.label}</span>
                      <span className={styles.views}>👁 {l.views}</span>
                      <span className={styles.stock}>{l.stock} left</span>
                    </div>
                  </div>
                  <div className={styles.cardActions}>
                    <Link href={`/market/${l.id}`} className={styles.viewBtn}>View</Link>
                    {l.status !== "sold" && l.status !== "deleted" && (
                      <button className={styles.toggleBtn} disabled={!!updating} onClick={() => toggleStatus(l)}>
                        {updating === l.id ? "..." : l.status === "active" ? "Pause" : "Activate"}
                      </button>
                    )}
                    <button className={styles.deleteBtn} disabled={!!updating} onClick={() => deleteListing(l.id)}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}