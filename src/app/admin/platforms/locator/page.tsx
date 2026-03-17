"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AdminPageHero from "@/components/admin/AdminPageHero";
import styles from "./page.module.css";

interface Business {
  id: string;
  name: string;
  category: string;
  description: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  website: string;
  pi_wallet: string;
  status: string;
  verified: boolean;
  avg_rating: number;
  review_count: number;
  created_at: string;
  image_url: string | null;
  images: string[];
  owner?: { username: string; avatar_url: string | null };
}

const CATEGORIES = [
  { key: "all",       label: "All",       emoji: "📍" },
  { key: "food",      label: "Food",      emoji: "🍜" },
  { key: "retail",    label: "Retail",    emoji: "🛍️" },
  { key: "services",  label: "Services",  emoji: "🔧" },
  { key: "online",    label: "Online",    emoji: "💻" },
  { key: "stay",      label: "Stay",      emoji: "🏡" },
  { key: "transport", label: "Transport", emoji: "🚗" },
  { key: "other",     label: "Other",     emoji: "📦" },
];

const STATUS_TABS = [
  { key: "pending",  label: "Pending",  color: "#f39c12" },
  { key: "approved", label: "Approved", color: "#27ae60" },
  { key: "rejected", label: "Rejected", color: "#e74c3c" },
];

function Badge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "#f39c12", approved: "#27ae60", rejected: "#e74c3c",
  };
  const c = colors[status] ?? "#999";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: c, background: `${c}18`, border: `1px solid ${c}30`, padding: "2px 8px", borderRadius: 999 }}>
      {status}
    </span>
  );
}

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

async function safeFetch(url: string, token: string): Promise<any> {
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const text = await r.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch { return null; }
}

export default function AdminLocatorPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading]       = useState(true);
  const [statusTab, setStatusTab]   = useState("pending");
  const [category, setCategory]     = useState("all");
  const [q, setQ]                   = useState("");
  const [actionId, setActionId]     = useState<string | null>(null);
  const [selected, setSelected]     = useState<Business | null>(null);
  const [counts, setCounts]         = useState({ pending: 0, approved: 0, rejected: 0 });

  const token = () => localStorage.getItem("supapi_admin_token") ?? "";

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status: statusTab });
    if (category !== "all") params.set("category", category);
    if (q) params.set("q", q);
    const d = await safeFetch(`/api/admin/locator?${params}`, token());
    if (d?.success) setBusinesses(d.data);
    setLoading(false);
  }, [statusTab, category, q]);

  const fetchCounts = useCallback(async () => {
    const d = await safeFetch("/api/admin/locator?counts=1", token());
    if (d?.success) setCounts(d.data);
  }, []);

  useEffect(() => { fetchBusinesses(); }, [fetchBusinesses]);
  useEffect(() => { fetchCounts(); }, []);

  const handleAction = async (id: string, action: "approve" | "reject" | "verify" | "unverify") => {
    setActionId(id);
    try {
      await fetch("/api/admin/locator", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ id, action }),
      });
      fetchBusinesses();
      fetchCounts();
      if (selected?.id === id) setSelected(null);
    } catch {}
    setActionId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this business permanently?")) return;
    setActionId(id);
    try {
      await fetch(`/api/admin/locator?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      fetchBusinesses();
      fetchCounts();
      setSelected(null);
    } catch {}
    setActionId(null);
  };

  const filtered = businesses.filter(b =>
    !q || b.name.toLowerCase().includes(q.toLowerCase()) || b.city.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="adminPage">
      <AdminPageHero
        icon="📍"
        title="Locator Admin"
        subtitle="Manage Pi-accepting business listings"
      />

      <div className="adminSection">
      {/* Status Tabs */}
      <div className={styles.tabs}>
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            className={`${styles.tab} ${statusTab === t.key ? styles.tabActive : ""}`}
            style={statusTab === t.key ? { borderBottomColor: t.color, color: t.color } : {}}
            onClick={() => { setStatusTab(t.key); }}
          >
            {t.label}
            <span className={styles.tabCount} style={statusTab === t.key ? { background: t.color } : {}}>
              {counts[t.key as keyof typeof counts]}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <input
          className={styles.search}
          placeholder="🔍 Search name or city..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <div className={styles.catFilter}>
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              className={`${styles.catBtn} ${category === c.key ? styles.catBtnActive : ""}`}
              onClick={() => setCategory(c.key)}
            >{c.emoji} {c.label}</button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className={styles.statsRow}>
        <div className={styles.statPill}>📍 {counts.approved} live businesses</div>
        <div className={styles.statPill}>⏳ {counts.pending} awaiting review</div>
      </div>

      {/* List */}
      {loading ? (
        <div className={styles.skeletonList}>
          {[...Array(4)].map((_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📭</div>
          <div className={styles.emptyText}>No {statusTab} businesses</div>
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map(b => (
            <div key={b.id} className={`${styles.card} ${selected?.id === b.id ? styles.cardSelected : ""}`}>
              <div className={styles.cardMain} onClick={() => setSelected(selected?.id === b.id ? null : b)}>
                <div className={styles.cardLeft}>
                  <div className={styles.cardEmoji}>
                    {CATEGORIES.find(c => c.key === b.category)?.emoji ?? "📍"}
                  </div>
                  <div className={styles.cardInfo}>
                    <div className={styles.cardName}>
                      {b.name}
                      {b.verified && <span className={styles.verifiedMark}>✅</span>}
                    </div>
                    <div className={styles.cardMeta}>
                      {b.city}, {b.country} · {CATEGORIES.find(c => c.key === b.category)?.label}
                    </div>
                    <div className={styles.cardMeta}>
                      by @{b.owner?.username ?? "unknown"} · {fmtDate(b.created_at)}
                    </div>
                  </div>
                </div>
                <div className={styles.cardRight}>
                  <Badge status={b.status} />
                  <span className={styles.cardArrow}>{selected?.id === b.id ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* Expanded detail */}
              {selected?.id === b.id && (
                <div className={styles.cardDetail}>
                  {/* Photos */}
                  {((b.images?.length > 0) || b.image_url) && (
                    <div className={styles.photoRow}>
                      {(b.images?.length > 0 ? b.images : [b.image_url]).map((url, i) => (
                        <img key={i} src={url!} alt={b.name} className={styles.photoThumb} />
                      ))}
                    </div>
                  )}

                  <div className={styles.detailGrid}>
                    {b.description && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Description</span>
                        <span className={styles.detailVal}>{b.description}</span>
                      </div>
                    )}
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Address</span>
                      <span className={styles.detailVal}>{b.address}, {b.city}</span>
                    </div>
                    {b.phone && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Phone</span>
                        <span className={styles.detailVal}>{b.phone}</span>
                      </div>
                    )}
                    {b.website && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Website</span>
                        <a href={b.website} target="_blank" rel="noreferrer" className={styles.detailLink}>{b.website}</a>
                      </div>
                    )}
                    {b.pi_wallet && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Pi Wallet</span>
                        <span className={styles.detailVal} style={{ fontFamily: "monospace", fontSize: 11 }}>{b.pi_wallet}</span>
                      </div>
                    )}
                    {b.avg_rating > 0 && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Rating</span>
                        <span className={styles.detailVal}>⭐ {b.avg_rating.toFixed(1)} ({b.review_count} reviews)</span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className={styles.actions}>
                    {b.status === "pending" && (
                      <>
                        <button
                          className={`${styles.actionBtn} ${styles.approveBtn}`}
                          disabled={actionId === b.id}
                          onClick={() => handleAction(b.id, "approve")}
                        >✅ Approve</button>
                        <button
                          className={`${styles.actionBtn} ${styles.rejectBtn}`}
                          disabled={actionId === b.id}
                          onClick={() => handleAction(b.id, "reject")}
                        >❌ Reject</button>
                      </>
                    )}
                    {b.status === "approved" && (
                      <>
                        <button
                          className={`${styles.actionBtn} ${b.verified ? styles.unverifyBtn : styles.verifyBtn}`}
                          disabled={actionId === b.id}
                          onClick={() => handleAction(b.id, b.verified ? "unverify" : "verify")}
                        >{b.verified ? "⭐ Remove Verify" : "✅ Mark Verified"}</button>
                        <button
                          className={`${styles.actionBtn} ${styles.rejectBtn}`}
                          disabled={actionId === b.id}
                          onClick={() => handleAction(b.id, "reject")}
                        >🚫 Suspend</button>
                      </>
                    )}
                    {b.status === "rejected" && (
                      <button
                        className={`${styles.actionBtn} ${styles.approveBtn}`}
                        disabled={actionId === b.id}
                        onClick={() => handleAction(b.id, "approve")}
                      >↩️ Re-approve</button>
                    )}
                    <button
                      className={`${styles.actionBtn} ${styles.deleteBtn}`}
                      disabled={actionId === b.id}
                      onClick={() => handleDelete(b.id)}
                    >🗑️ Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </div>

      <div className="adminQuickLinks">
        <Link href="/admin/dashboard" className="adminBackBtn">Back to Dashboard</Link>
      </div>
    </div>
  );
}