"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminPageHero from "@/components/admin/AdminPageHero";
import KycBadge from "@/components/ui/KycBadge";
import styles from "./page.module.css";

interface UserDetail {
  user: {
    id: string; username: string; display_name: string | null; avatar_url: string | null;
    kyc_status: string; role: string; created_at: string;
    bio: string | null; email: string | null; phone: string | null;
    city: string | null; country: string | null; wallet_address: string | null;
  };
  listings: any[];
  listing_count: number;
  orders: any[];
  order_count: number;
}

const STATUS_COLOR: Record<string, string> = {
  active:"#27ae60", paused:"#f39c12", sold:"#7f8c8d", deleted:"#e74c3c",
  pending:"#f39c12", paid:"#27ae60", completed:"#27ae60", disputed:"#e74c3c",
  refunded:"#7f8c8d", cancelled:"#95a5a6", shipped:"#2980b9",
};

function Badge({ status }: { status: string }) {
  const c = STATUS_COLOR[status] ?? "#999";
  return <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:999, color:c, background:`${c}18`, border:`1px solid ${c}30` }}>{status}</span>;
}
function fmt(iso: string) { return new Date(iso).toLocaleDateString("en-MY", { day:"numeric", month:"short", year:"numeric" }); }
function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }
const PAGE_SIZE = 10;

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router  = useRouter();
  const [data, setData]     = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken]   = useState("");
  const [msg, setMsg]       = useState("");
  const [banReason, setBanReason] = useState("");
  const [showBan, setShowBan]     = useState(false);
  const [saving, setSaving] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);

  useEffect(() => { setToken(localStorage.getItem("supapi_admin_token") ?? ""); }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`/api/admin/users/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (d.success) setData(d.data); })
      .finally(() => setLoading(false));
  }, [token, id]);

  const patch = async (updates: object, successMsg: string) => {
    setSaving(true);
    const r = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(updates),
    });
    const d = await r.json();
    if (d.success && data) { setData({ ...data, user: { ...data.user, ...d.data } }); setMsg(successMsg); setTimeout(() => setMsg(""), 2500); }
    setSaving(false); setShowBan(false); setBanReason("");
  };

  if (loading) return <div className={styles.loading}><div>Loading...</div></div>;
  if (!data)   return <div className={styles.loading}><div>User not found</div><button onClick={() => router.back()}>← Back</button></div>;

  const { user, listings, listing_count, orders, order_count } = data;
  const isBanned = user.role === "banned";

  return (
    <div className="adminPage">
      <AdminPageHero
        icon="👤"
        title="User Detail"
        subtitle="Review account profile, activity, and moderation status"
      />

      <div className="adminQuickLinks">
        <Link href="/admin/users" className="adminBackBtn">Back to Users</Link>
      </div>

      {msg && <div className={styles.msgBanner}>{msg}</div>}

      {/* Profile card */}
      <div className={styles.profileCard}>
        <div className={styles.avatar}>
          {user.avatar_url
            ? <img src={user.avatar_url} alt="" className={styles.avatarImg} />
            : <span>{getInitial(user.username)}</span>
          }
          {isBanned && <div className={styles.bannedOverlay}>BANNED</div>}
        </div>
        <div className={styles.profileInfo}>
          <div className={styles.profileName}>
            {user.display_name ?? user.username}
            {user.kyc_status === "verified" && <KycBadge size={14} />}
          </div>
          <div className={styles.profileSub}>@{user.username} · {user.role}</div>
          {user.bio && <div className={styles.profileBio}>{user.bio}</div>}
        </div>
      </div>

      {/* Admin Actions */}
      <div className={styles.actionsCard}>
        <div className={styles.cardTitle}>Admin Actions</div>
        <div className={styles.userSub} style={{ marginBottom: 10 }}>
          KYC status is auto-synced from Pi on sign-in. You can manually set it if the user has verified but Pi didn&apos;t return it.
        </div>
        <div className={styles.actionGrid} style={{ flexWrap: "wrap", gap: 10 }}>
          <div className={styles.kycSelectRow}>
            <label className={styles.kycLabel}>KYC Status</label>
            <select
              className={styles.kycSelect}
              value={user.kyc_status}
              onChange={(e) => patch({ kyc_status: e.target.value }, "KYC status updated")}
              disabled={saving}
            >
              <option value="unverified">Unverified</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
            </select>
          </div>
          {!isBanned
            ? <button className={styles.dangerBtn} onClick={() => setShowBan(true)}>🚫 Ban User</button>
            : <button className={styles.okBtn} disabled={saving} onClick={() => patch({ is_banned: false }, "✅ User unbanned!")}>✅ Unban User</button>
          }
        </div>
      </div>

      {/* User info */}
      <div className={styles.infoCard}>
        <div className={styles.cardTitle}>Account Info</div>
        {[
          { label: "User ID",       val: user.id },
          { label: "Email",         val: user.email ?? "—" },
          { label: "Phone",         val: user.phone ?? "—" },
          { label: "Location",      val: [user.city, user.country].filter(Boolean).join(", ") || "—" },
          { label: "KYC Status",    val: user.kyc_status },
          { label: "Joined",        val: fmt(user.created_at) },
          { label: "Wallet",        val: user.wallet_address ? `${user.wallet_address.slice(0,12)}...` : "—" },
        ].map(row => (
          <div key={row.label} className={styles.infoRow}>
            <span>{row.label}</span><strong>{row.val}</strong>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statBox}>
          <div className={styles.statNum}>{listing_count}</div>
          <div className={styles.statLbl}>Total Listings</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statNum}>{order_count}</div>
          <div className={styles.statLbl}>Total Orders</div>
        </div>
      </div>

      {/* Listings */}
      {listings.length > 0 && (
        <div className={styles.listCard}>
          <div className={styles.cardTitle}>Recent Listings ({listing_count})</div>
          {listings.map((l: any) => (
            <Link key={l.id} href={`/supamarket/${l.id}`} className={styles.listRow}>
              <div className={styles.listTitle}>{l.title}</div>
              <div className={styles.listMeta}>
                <span className={styles.piAmt}>{Number(l.price_pi).toFixed(2)} π</span>
                <Badge status={l.status} />
                <span className={styles.listDate}>{fmt(l.created_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Orders — 10 per page */}
      {orders.length > 0 && (
        <div className={styles.listCard}>
          <div className={styles.cardTitle}>Recent Orders ({order_count})</div>
          {(() => {
            const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
            const pageSafe = Math.min(ordersPage, totalPages);
            const pageOrders = orders.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
            return (
              <>
                {pageOrders.map((o: any) => (
                  <Link key={o.id} href={`/supamarket/orders/${o.id}`} className={styles.listRow}>
                    <div className={styles.listTitle}>{o.id.slice(0, 10)}…</div>
                    <div className={styles.listMeta}>
                      <span className={styles.piAmt}>{Number(o.amount_pi).toFixed(2)} π</span>
                      <Badge status={o.status} />
                      <span className={styles.listDate}>{fmt(o.created_at)}</span>
                    </div>
                  </Link>
                ))}
                {totalPages > 1 && (
                  <div className={styles.pager}>
                    <button type="button" className={styles.pagerBtn} disabled={pageSafe === 1} onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}>← Prev</button>
                    <span className={styles.pagerInfo}>Page {pageSafe} of {totalPages}</span>
                    <button type="button" className={styles.pagerBtn} disabled={pageSafe === totalPages} onClick={() => setOrdersPage((p) => Math.min(totalPages, p + 1))}>Next →</button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Ban modal */}
      {showBan && (
        <div className={styles.overlay} onClick={() => setShowBan(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>🚫 Ban @{user.username}</div>
            <textarea className={styles.modalInput} rows={3} placeholder="Reason for ban..." value={banReason} onChange={e => setBanReason(e.target.value)} />
            <div className={styles.modalBtns}>
              <button className={styles.modalCancel} onClick={() => setShowBan(false)}>Cancel</button>
              <button className={styles.modalDanger} disabled={!banReason.trim() || saving}
                onClick={() => patch({ is_banned: true, ban_reason: banReason }, "🚫 User banned!")}>
                {saving ? "..." : "Ban User"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="adminQuickLinks">
        <Link href="/admin/dashboard" className="adminBackBtn">Back to Dashboard</Link>
      </div>
    </div>
  );
}