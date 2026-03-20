"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AdminTabs from "@/components/admin/AdminTabs";
import AdminPageHero from "@/components/admin/AdminPageHero";
import KycBadge from "@/components/ui/KycBadge";
import styles from "./page.module.css";

interface Stats {
  listings: { total: number; active: number };
  orders: { total: number; pending: number; completed: number; disputed: number };
  revenue: { total_pi: number; commission_pi: number; commission_pct: number; estimated_commission: number };
  recent_orders: any[];
}
interface Listing { id:string; title:string; price_pi:number; category:string; status:string; stock:number; views:number; created_at:string; images:string[]; seller:{id:string;username:string;display_name:string|null;avatar_url:string|null;kyc_status:string;is_banned:boolean}; }
interface Order   { id:string; status:string; amount_pi:number; buying_method:string; created_at:string; pi_payment_id:string; listing:{id:string;title:string;images:string[]}|null; buyer:{id:string;username:string;display_name:string|null}; seller:{id:string;username:string;display_name:string|null}; }
interface Dispute { id:string; reason:string; evidence?: string[]; status:string; ai_decision:string; ai_reasoning:string; ai_confidence:number; created_at:string; resolved_at:string | null; refund_status?: string | null; refund_txid?: string | null; refund_amount_pi?: number | null; opened_by_user:{id:string;username:string;display_name:string|null}; order:{id:string;amount_pi:number;status:string;buyer:{username:string};seller:{username:string};listing:{title:string}}|null; }
interface User    { id:string; username:string; display_name:string|null; avatar_url:string|null; kyc_status:string; role:string; is_banned:boolean; ban_reason:string|null; seller_verified:boolean; created_at:string; last_seen:string|null; }
const STATUS_COLOR: Record<string,string> = {
  active:"#27ae60", paused:"#f39c12", sold:"#7f8c8d", removed:"#e74c3c",
  pending:"#f39c12", paid:"#27ae60", shipped:"#2980b9", meetup_set:"#8e44ad",
  delivered:"#27ae60", completed:"#27ae60", disputed:"#e74c3c", refunded:"#7f8c8d", cancelled:"#95a5a6",
  open:"#f39c12", ai_reviewing:"#2980b9", resolved:"#27ae60", collected:"#27ae60", manual_review:"#f39c12",
};
function Badge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? "#999";
  return <span className={styles.badge} style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}>{status}</span>;
}
function Stat({ label, value, sub, color }: { label:string; value:string|number; sub?:string; color?:string }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statValue} style={color?{color}:{}}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  );
}
function fmt(iso: string) { return new Date(iso).toLocaleDateString("en-MY", { day:"numeric", month:"short", year:"numeric" }); }
function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }

const TABS = [
  { id:"overview",   label:"📊 Overview"   },
  { id:"listings",   label:"🛍️ Listings"   },
  { id:"orders",     label:"📦 Orders"     },
  { id:"disputes",   label:"⚖️ Disputes"   },
  { id:"users",      label:"👥 Users"      },
  { id:"commission", label:"💰 Commission" },
];
type TabId = "overview"|"listings"|"orders"|"disputes"|"users"|"commission";
const TAB_IDS = new Set(TABS.map((t) => t.id));
function getTabFromHash(): TabId | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace("#", "").trim();
  if (TAB_IDS.has(hash)) return hash as TabId;
  return null;
}

export default function AdminMarketPage() {
  const [tab, setTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");
  const [stats, setStats] = useState<Stats|null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [disputeQueue, setDisputeQueue] = useState<{ open: number; needs_review: number }>({ open: 0, needs_review: 0 });
  const [users, setUsers] = useState<User[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [commConfig, setCommConfig] = useState<any>(null);
  const [listQ, setListQ] = useState(""); const [listStatus, setListStatus] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [disputeStatus, setDisputeStatus] = useState("");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [userQ, setUserQ] = useState(""); const [userFilter, setUserFilter] = useState("");
  const [commPct, setCommPct] = useState(""); const [savingComm, setSavingComm] = useState(false); const [commMsg, setCommMsg] = useState("");
  const [reconcileLoading, setReconcileLoading] = useState<"dry" | "run" | null>(null);
  const [reconcileResult, setReconcileResult] = useState<any>(null);
  const [overrideId, setOverrideId] = useState<string|null>(null);
  const [overrideDecision, setOverrideDecision] = useState<"refund"|"release">("release");
  const [overrideReason, setOverrideReason] = useState(""); const [overriding, setOverriding] = useState(false);
  const [applyingId, setApplyingId] = useState<string|null>(null);
  const [refundTarget, setRefundTarget] = useState<Dispute | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [refundSuccess, setRefundSuccess] = useState<{ disputeId: string; txid: string; amount: number } | null>(null);
  const [disputeToast, setDisputeToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [recentOrdersPage, setRecentOrdersPage] = useState(1);
  const [ordersListPage, setOrdersListPage] = useState(1);
  const [disputesPage, setDisputesPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const ADMIN_PAGE_SIZE = 10;
  const [banUserId, setBanUserId] = useState<string|null>(null); const [banReason, setBanReason] = useState("");
  const [userActionMsg, setUserActionMsg] = useState<Record<string,string>>({});
  const [orderActionMsg, setOrderActionMsg] = useState<Record<string, string>>({});
  const [orderActionLoading, setOrderActionLoading] = useState<Record<string, boolean>>({});

  useEffect(() => { setToken(localStorage.getItem("supapi_admin_token") ?? ""); }, []);
  useEffect(() => {
    const applyHashTab = () => {
      const tabFromHash = getTabFromHash();
      if (tabFromHash) setTab(tabFromHash);
    };
    applyHashTab();
    window.addEventListener("hashchange", applyHashTab);
    return () => window.removeEventListener("hashchange", applyHashTab);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentHash = window.location.hash.replace("#", "").trim();
    if (currentHash !== tab) {
      window.history.replaceState(null, "", `${window.location.pathname}#${tab}`);
    }
  }, [tab]);

  const adminFetch = useCallback(async (url: string, opts?: RequestInit) =>
    fetch(url, { ...opts, headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}`, ...(opts?.headers??{}) } }), [token]);

  useEffect(() => { if (!token || tab !== "overview") return; setLoading(true); adminFetch("/api/admin/supamarket/stats").then(r=>r.json()).then(d=>{if(d.success)setStats(d.data);}).finally(()=>setLoading(false)); }, [token,tab,adminFetch]);
  useEffect(() => { if (!token || tab !== "listings") return; setLoading(true); adminFetch(`/api/admin/supamarket/listings?q=${listQ}&status=${listStatus}`).then(r=>r.json()).then(d=>{if(d.success){setListings(d.data.listings);setListTotal(d.data.total);}}).finally(()=>setLoading(false)); }, [token,tab,listQ,listStatus,adminFetch]);
  useEffect(() => { if (!token || tab !== "orders") return; setLoading(true); adminFetch(`/api/admin/supamarket/orders?status=${orderStatus}`).then(r=>r.json()).then(d=>{if(d.success){setOrders(d.data.orders);setOrderTotal(d.data.total);}}).finally(()=>setLoading(false)); }, [token,tab,orderStatus,adminFetch]);
  useEffect(() => {
    if (!token || tab !== "disputes") return;
    setLoading(true);
    const params = new URLSearchParams({
      status: disputeStatus,
      needs_review: needsReviewOnly ? "true" : "false",
    });
    adminFetch(`/api/admin/supamarket/disputes?${params}`)
      .then(r=>r.json())
      .then(d=>{
        if(d.success){
          setDisputes(d.data.disputes);
          setDisputeQueue(d.data.queue ?? { open: 0, needs_review: 0 });
        }
      })
      .finally(()=>setLoading(false));
  }, [token,tab,disputeStatus,needsReviewOnly,adminFetch]);
  useEffect(() => { if (!token || tab !== "users") return; setLoading(true); adminFetch(`/api/admin/users?q=${userQ}&filter=${userFilter}`).then(r=>r.json()).then(d=>{if(d.success){setUsers(d.data.users??[]);setUserTotal(d.data.total??0);}}).finally(()=>setLoading(false)); }, [token,tab,userQ,userFilter,adminFetch]);
  useEffect(() => { if (!token || tab !== "commission") return; setLoading(true); adminFetch("/api/admin/supamarket/commission").then(r=>r.json()).then(d=>{if(d.success){setCommConfig(d.data);setCommPct(String(d.data.commission_pct));}}).finally(()=>setLoading(false)); }, [token,tab,adminFetch]);

  const suspendListing = async (id: string, status: string) => { await adminFetch(`/api/admin/supamarket/listings/${id}`,{method:"PATCH",body:JSON.stringify({status})}); setListings(prev=>prev.map(l=>l.id===id?{...l,status}:l)); };
  const overrideDispute = async () => {
    if(!overrideId)return;
    setOverriding(true);
    if (overrideDecision === "refund") {
      const r = await adminFetch(`/api/admin/disputes/${overrideId}/refund`, { method: "POST" });
      const d = await r.json();
      if (d.success) {
        setDisputes((prev) =>
          prev.map((dp) =>
            dp.id === overrideId
              ? {
                  ...dp,
                  status: "resolved",
                  ai_decision: "refund",
                  refund_status: "completed",
                  refund_txid: String(d?.refund?.txid ?? ""),
                  refund_amount_pi: Number(d?.refund?.amount_pi ?? dp.order?.amount_pi ?? 0),
                  resolved_at: new Date().toISOString(),
                  order: dp.order ? { ...dp.order, status: "refunded" } : dp.order,
                }
              : dp
          )
        );
        showDisputeToast("Refund issued — Pi sent to buyer", "ok");
        setOverrideId(null);
        setOverrideReason("");
      } else {
        showDisputeToast(d.error ?? "Refund failed", "err");
      }
    } else {
      const r=await adminFetch(`/api/admin/supamarket/disputes/${overrideId}`,{method:"PATCH",body:JSON.stringify({decision:overrideDecision,reasoning:overrideReason})});
      const d=await r.json();
      if(d.success){
        setDisputes(prev=>prev.map(dp=>dp.id===overrideId?{...dp,ai_decision:overrideDecision,status:"resolved",ai_reasoning:`[Admin Override] ${overrideReason}`}:dp));
        setOverrideId(null);
        setOverrideReason("");
      }
    }
    setOverriding(false);
  };

  const applySuggestion = async (disputeId: string, decision: string, reasoning: string) => {
    if (decision !== "refund" && decision !== "release") return;
    setApplyingId(disputeId);
    try {
      if (decision === "refund") {
        const r = await adminFetch(`/api/admin/disputes/${disputeId}/refund`, { method: "POST" });
        const d = await r.json();
        if (d.success) {
          setDisputes((prev) =>
            prev.map((dp) =>
              dp.id === disputeId
                ? {
                    ...dp,
                    status: "resolved",
                    ai_decision: "refund",
                    refund_status: "completed",
                    refund_txid: String(d?.refund?.txid ?? ""),
                    refund_amount_pi: Number(d?.refund?.amount_pi ?? dp.order?.amount_pi ?? 0),
                    resolved_at: new Date().toISOString(),
                    order: dp.order ? { ...dp.order, status: "refunded" } : dp.order,
                  }
                : dp
            )
          );
          showDisputeToast("Refund issued — Pi sent to buyer", "ok");
        } else {
          showDisputeToast(d.error ?? "Refund failed", "err");
        }
      } else {
        const r = await adminFetch(`/api/admin/supamarket/disputes/${disputeId}`, { method: "PATCH", body: JSON.stringify({ decision, reasoning: reasoning?.trim() || "Applied suggested resolution." }) });
        const d = await r.json();
        if (d.success) {
          setDisputes(prev => prev.map(dp => dp.id === disputeId ? { ...dp, ai_decision: decision, status: "resolved", ai_reasoning: reasoning || "Applied suggested resolution." } : dp));
        }
      }
    } finally {
      setApplyingId(null);
    }
  };
  const showDisputeToast = (msg: string, type: "ok" | "err" = "ok") => {
    setDisputeToast({ msg, type });
    setTimeout(() => setDisputeToast(null), 3200);
  };
  const issueBuyerRefund = async () => {
    if (!refundTarget) return;
    setRefunding(true);
    setRefundSuccess(null);
    try {
      const r = await adminFetch(`/api/admin/disputes/${refundTarget.id}/refund`, { method: "POST" });
      const d = await r.json();
      if (!d.success) {
        showDisputeToast(d.error ?? "Refund failed", "err");
        return;
      }
      const txid = String(d?.refund?.txid ?? "n/a");
      const amount = Number(d?.refund?.amount_pi ?? refundTarget.order?.amount_pi ?? 0);
      setRefundSuccess({ disputeId: refundTarget.id, txid, amount });
      showDisputeToast("Refund issued — Pi sent to buyer", "ok");
      setDisputes((prev) =>
        prev.map((dp) =>
          dp.id === refundTarget.id
            ? {
                ...dp,
                status: "resolved",
                refund_status: "completed",
                refund_txid: txid,
                refund_amount_pi: amount,
                resolved_at: new Date().toISOString(),
                order: dp.order ? { ...dp.order, status: "refunded" } : dp.order,
              }
            : dp
        )
      );
    } finally {
      setRefunding(false);
    }
  };
  const updateUser = async (userId: string, patch: object, msg: string) => { const r=await adminFetch(`/api/admin/users/${userId}`,{method:"PATCH",body:JSON.stringify(patch)}); const d=await r.json(); if(d.success){setUsers(prev=>prev.map(u=>u.id===userId?{...u,...d.data}:u));setUserActionMsg(prev=>({...prev,[userId]:msg}));setTimeout(()=>setUserActionMsg(prev=>{const n={...prev};delete n[userId];return n;}),2500);} setBanUserId(null);setBanReason(""); };
  const saveCommission = async () => { const pct=parseFloat(commPct); if(isNaN(pct)||pct<0||pct>50){setCommMsg("Enter 0–50");return;} setSavingComm(true); const r=await adminFetch("/api/admin/supamarket/commission",{method:"PATCH",body:JSON.stringify({commission_pct:pct})}); const d=await r.json(); setCommMsg(d.success?"✅ Saved!":"❌ Failed"); if(d.success&&commConfig)setCommConfig({...commConfig,commission_pct:pct}); setTimeout(()=>setCommMsg(""),2500); setSavingComm(false); };
  const runEarningsReconcile = async (execute: boolean) => {
    setReconcileLoading(execute ? "run" : "dry");
    setReconcileResult(null);
    try {
      const r = await adminFetch("/api/admin/supamarket/earnings/reconcile", {
        method: "POST",
        body: JSON.stringify({ execute, limit: 300 }),
      });
      const d = await r.json();
      if (!d?.success) {
        setReconcileResult({ error: d?.error ?? "Failed to run reconcile" });
      } else {
        setReconcileResult(d.data);
      }
    } catch {
      setReconcileResult({ error: "Failed to run reconcile" });
    } finally {
      setReconcileLoading(null);
    }
  };
  const exportCSV = async (type: "orders" | "listings" | "commissions") => {
    setExporting(type);
    try {
      const r = await adminFetch(`/api/admin/supamarket/export?type=${type}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `supapi_${type}_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
    setExporting(null);
  };
  const simulateOrderAutoCredit = async (orderId: string, execute: boolean) => {
    const loadingKey = `${orderId}:${execute ? "execute" : "dry"}`;
    setOrderActionLoading((prev) => ({ ...prev, [loadingKey]: true }));
    try {
      const r = await adminFetch(`/api/admin/supamarket/orders/${orderId}/simulate-complete`, {
        method: "POST",
        body: JSON.stringify({ execute }),
      });
      const d = await r.json();
      if (d.success) {
        const msg = execute
          ? `✅ Recovery payout sent: ${Number(d?.data?.amount_pi ?? 0).toFixed(4)} π`
          : `🧪 Simulation OK · payout ${Number(d?.data?.would_credit?.amount_pi ?? 0).toFixed(4)} π`;
        setOrderActionMsg((prev) => ({ ...prev, [orderId]: msg }));
      } else {
        setOrderActionMsg((prev) => ({ ...prev, [orderId]: `❌ ${d.error ?? "Request failed"}` }));
      }
    } catch {
      setOrderActionMsg((prev) => ({ ...prev, [orderId]: "❌ Network/server error" }));
    } finally {
      setOrderActionLoading((prev) => ({ ...prev, [loadingKey]: false }));
      setTimeout(() => {
        setOrderActionMsg((prev) => {
          const next = { ...prev };
          delete next[orderId];
          return next;
        });
      }, 5000);
    }
  };

  return (
    <div className="adminPage">
      {disputeToast && (
        <div className={`${styles.disputeToast} ${disputeToast.type === "ok" ? styles.disputeToastOk : styles.disputeToastErr}`}>
          {disputeToast.msg}
        </div>
      )}
      <AdminPageHero
        icon="🛍️"
        title="SupaMarket Admin"
        subtitle="Manage listings, orders, disputes, and commission settings"
        showBadge
      />

      <AdminTabs tabs={TABS} active={tab} onChange={(id) => setTab(id as TabId)} />

      <div className={styles.body}>
        {loading && <div className={styles.loadingBar}/>}

        {tab === "overview" && stats && (
          <div>
            <div className={styles.statGrid}>
              <Stat label="Total Listings"  value={stats.listings.total}   sub={`${stats.listings.active} active`}/>
              <Stat label="Total Orders"    value={stats.orders.total}     sub={`${stats.orders.pending} pending`}/>
              <Stat label="Completed Sales" value={stats.orders.completed} color="#27ae60"/>
              <Stat label="Open Disputes"   value={stats.orders.disputed}  color={stats.orders.disputed>0?"#e74c3c":undefined}/>
              <Stat label="Total GMV"       value={`${stats.revenue.total_pi.toFixed(2)} π`} sub="Gross merchandise value" color="#F5A623"/>
              <Stat label="Total Commission" value={`${stats.revenue.commission_pi.toFixed(4)} π`} sub={`@ ${stats.revenue.commission_pct}% · Est from GMV: ${stats.revenue.estimated_commission.toFixed(4)} π`} color="#2980b9"/>
            </div>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Recent Orders</div>
              {(()=>{
                const list = stats.recent_orders ?? [];
                const totalPages = Math.max(1, Math.ceil(list.length / ADMIN_PAGE_SIZE));
                const pageSafe = Math.min(recentOrdersPage, totalPages);
                const pageList = list.slice((pageSafe - 1) * ADMIN_PAGE_SIZE, pageSafe * ADMIN_PAGE_SIZE);
                return (
                  <>
                    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Order</th><th>Item</th><th>Buyer</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>{pageList.map((o:any)=>(
                      <tr key={o.id}><td className={styles.mono}>{o.id.slice(0,8)}…</td><td>{o.listing?.title??"—"}</td><td>@{o.buyer?.username}</td><td className={styles.piAmt}>{Number(o.amount_pi).toFixed(2)} π</td><td>{o.buying_method==="ship"?"📦":"📍"}</td><td><Badge status={o.status}/></td><td>{fmt(o.created_at)}</td></tr>
                    ))}</tbody></table></div>
                    {totalPages > 1 && (
                      <div className={styles.pager}>
                        <button type="button" className={styles.pagerBtn} disabled={pageSafe===1} onClick={()=>setRecentOrdersPage(p=>Math.max(1,p-1))}>← Prev</button>
                        <span className={styles.pagerInfo}>Page {pageSafe} of {totalPages}</span>
                        <button type="button" className={styles.pagerBtn} disabled={pageSafe===totalPages} onClick={()=>setRecentOrdersPage(p=>Math.min(totalPages,p+1))}>Next →</button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {tab === "listings" && (
          <div className={styles.section}>
            <div className={styles.filterRow}>
              <input className={styles.searchInput} placeholder="Search listings..." value={listQ} onChange={e=>setListQ(e.target.value)}/>
              <select className={styles.select} value={listStatus} onChange={e=>setListStatus(e.target.value)}>
                <option value="">All Status</option>
                {["active","paused","sold","removed"].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className={styles.countRow}>{listTotal} listings</div>
            <div className={styles.tableWrap}><table className={styles.table}>
              <thead><tr><th>Img</th><th>Title</th><th>Seller</th><th>Price</th><th>Cat</th><th>Stock</th><th>Views</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{listings.map(l=>(
                <tr key={l.id}>
                  <td><div className={styles.thumbCell}>{l.images?.[0]?<img src={l.images[0]} alt="" className={styles.tableThumb}/>:"🛍️"}</div></td>
                  <td><Link href={`/supamarket/${l.id}`} className={styles.link}>{l.title}</Link></td>
                  <td><span className={styles.userCell}>@{(l.seller?.username ?? "").trim() || "unknown"}{l.seller?.kyc_status==="verified"&&<KycBadge size={14} />}{l.seller?.is_banned&&<span className={styles.bannedTag}>BANNED</span>}</span></td>
                  <td className={styles.piAmt}>{Number(l.price_pi).toFixed(2)} π</td><td>{l.category}</td><td>{l.stock}</td><td>{l.views}</td>
                  <td><Badge status={l.status}/></td>
                  <td><div className={styles.actionBtns}>
                    {l.status==="active"&&<button className={styles.warnBtn} onClick={()=>suspendListing(l.id,"paused")}>Pause</button>}
                    {l.status==="paused"&&<button className={styles.okBtn} onClick={()=>suspendListing(l.id,"active")}>Restore</button>}
                    {l.status!=="removed"&&<button className={styles.dangerBtn} onClick={()=>suspendListing(l.id,"removed")}>Delete</button>}
                  </div></td>
                </tr>
              ))}</tbody></table></div>
          </div>
        )}

        {tab === "orders" && (
          <div className={styles.section}>
            <div className={styles.filterRow}>
              <select className={styles.select} value={orderStatus} onChange={e=>setOrderStatus(e.target.value)}>
                <option value="">All Status</option>
                {["pending","paid","shipped","meetup_set","delivered","completed","disputed","refunded","cancelled"].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className={styles.countRow}>{orderTotal} orders</div>
            {(()=>{
              const totalPages = Math.max(1, Math.ceil(orders.length / ADMIN_PAGE_SIZE));
              const pageSafe = Math.min(ordersListPage, totalPages);
              const pageList = orders.slice((pageSafe - 1) * ADMIN_PAGE_SIZE, pageSafe * ADMIN_PAGE_SIZE);
              return (
            <>
            <div className={styles.tableWrap}><table className={styles.table}>
              <thead><tr><th>Order ID</th><th>Item</th><th>Buyer</th><th>Seller</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>{pageList.map(o=>(
                <tr key={o.id}>
                  <td className={styles.mono}>{o.id.slice(0,8)}…</td><td>{o.listing?.title??"—"}</td>
                  <td>@{o.buyer?.username}</td><td>@{o.seller?.username}</td>
                  <td className={styles.piAmt}>{Number(o.amount_pi).toFixed(2)} π</td>
                  <td>{o.buying_method==="ship"?"📦 Ship":"📍 Meetup"}</td>
                  <td><Badge status={o.status}/></td><td>{fmt(o.created_at)}</td>
                  <td><div className={styles.actionBtns}>
                    {o.status==="disputed"&&<button className={styles.warnBtn} onClick={()=>{setTab("disputes");setDisputeStatus("open");}}>Open Disputes</button>}
                    {!["completed","refunded","cancelled"].includes(o.status)&&<button className={styles.dangerBtn} onClick={async()=>{await adminFetch(`/api/admin/supamarket/orders/${o.id}`,{method:"PATCH",body:JSON.stringify({status:"cancelled"})});setOrders(prev=>prev.map(x=>x.id===o.id?{...x,status:"cancelled"}:x));}}>Cancel</button>}
                    {o.status === "completed" && (
                      <>
                        <button
                          className={styles.warnBtn}
                          disabled={Boolean(orderActionLoading[`${o.id}:dry`])}
                          onClick={() => simulateOrderAutoCredit(o.id, false)}
                          title="Simulate payout recovery without changing wallet"
                        >
                          {orderActionLoading[`${o.id}:dry`] ? "Checking..." : "Simulate Seller Payout"}
                        </button>
                        <button
                          className={styles.okBtn}
                          disabled={Boolean(orderActionLoading[`${o.id}:execute`])}
                          onClick={() => simulateOrderAutoCredit(o.id, true)}
                          title="Force payout recovery to seller wallet (manual recovery tool)"
                        >
                          {orderActionLoading[`${o.id}:execute`] ? "Processing..." : "Force Seller Payout (Recovery)"}
                        </button>
                      </>
                    )}
                  </div></td>
                </tr>
                
              ))}</tbody></table></div>
              {totalPages > 1 && (
                <div className={styles.pager}>
                  <button type="button" className={styles.pagerBtn} disabled={pageSafe===1} onClick={()=>setOrdersListPage(p=>Math.max(1,p-1))}>← Prev</button>
                  <span className={styles.pagerInfo}>Page {pageSafe} of {totalPages}</span>
                  <button type="button" className={styles.pagerBtn} disabled={pageSafe===totalPages} onClick={()=>setOrdersListPage(p=>Math.min(totalPages,p+1))}>Next →</button>
                </div>
              )}
            {orders.some((o) => orderActionMsg[o.id]) && (
              <div className={styles.orderActionStack}>
                {orders.filter((o) => orderActionMsg[o.id]).map((o) => (
                  <div key={`${o.id}-msg`} className={styles.orderActionMsg}>
                    <span className={styles.mono}>{o.id.slice(0, 8)}…</span> {orderActionMsg[o.id]}
                  </div>
                ))}
              </div>
            )}
            </>
              );
            })()}
          </div>
        )}

        {tab === "disputes" && (
          <div className={styles.section}>
            <div className={styles.filterRow}>
              <select className={styles.select} value={disputeStatus} onChange={e=>setDisputeStatus(e.target.value)}>
                <option value="">All</option>
                {["open","resolved"].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <button className={`${styles.warnBtn} ${needsReviewOnly ? styles.warnBtnActive : ""}`} onClick={()=>setNeedsReviewOnly(v=>!v)}>
                {needsReviewOnly ? `Showing Needs Review (${disputeQueue.needs_review})` : `Needs Review Queue (${disputeQueue.needs_review})`}
              </button>
              <span className={styles.queueInfo}>Open: {disputeQueue.open}</span>
            </div>
            {disputes.length===0&&<div className={styles.empty}>No disputes found 🎉</div>}
            {(()=>{
              const totalPages = Math.max(1, Math.ceil(disputes.length / ADMIN_PAGE_SIZE));
              const pageSafe = Math.min(disputesPage, totalPages);
              const pageList = disputes.slice((pageSafe - 1) * ADMIN_PAGE_SIZE, pageSafe * ADMIN_PAGE_SIZE);
              return (
            <>
            {pageList.map(d=>(
              <div key={d.id} className={styles.disputeCard}>
                <div className={styles.disputeHeader}>
                  <div>
                    <div className={styles.disputeTitle}>{d.order?.listing?.title??"Unknown Item"}</div>
                    <div className={styles.disputeMeta}>@{d.opened_by_user?.username} · {fmt(d.created_at)} · Buyer: @{d.order?.buyer?.username} → Seller: @{d.order?.seller?.username}</div>
                  </div>
                  <div className={styles.disputeRight}><Badge status={d.status}/><div className={styles.piAmt}>{Number(d.order?.amount_pi??0).toFixed(2)} π</div></div>
                </div>
                <div className={styles.disputeReason}><strong>Reason:</strong> {d.reason}</div>
                {!!d.evidence?.length && (
                  <div className={styles.disputeEvidenceWrap}>
                    <div className={styles.disputeEvidenceTitle}>Evidence</div>
                    <div className={styles.disputeEvidenceGrid}>
                      {d.evidence.filter((item) => /^https?:\/\//i.test(item)).slice(0, 6).map((url) => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className={styles.disputeEvidenceLink}>
                          <img src={url} alt="Dispute evidence" className={styles.disputeEvidenceImg} />
                        </a>
                      ))}
                    </div>
                    {d.evidence.filter((item) => !/^https?:\/\//i.test(item)).length > 0 && (
                      <div className={styles.disputeEvidenceMeta}>
                        {d.evidence.filter((item) => !/^https?:\/\//i.test(item)).slice(0, 4).join(" · ")}
                      </div>
                    )}
                  </div>
                )}
                {d.ai_decision&&<div className={`${styles.aiDecision} ${d.ai_decision==="refund"?styles.aiRefund:d.ai_decision==="manual_review"?styles.aiManual:styles.aiRelease}`}>
                  <strong>Suggested resolution:</strong> {d.ai_decision==="refund"?"↩️ Refund":d.ai_decision==="manual_review"?"🕵️ Manual Review":"✅ Release"} · {Math.round((d.ai_confidence??0)*100)}% confidence
                  <div className={styles.aiReasoning}>{d.ai_reasoning}</div>
                </div>}
                {(d.refund_status === "completed" || d.refund_txid) && (
                  <div className={styles.refundDoneBanner}>
                    <span>✅ Refund issued</span>
                    <span>{Number(d.refund_amount_pi ?? d.order?.amount_pi ?? 0).toFixed(2)}π</span>
                    <span className={styles.mono}>tx: {(d.refund_txid ?? "").slice(0, 20)}{(d.refund_txid ?? "").length > 20 ? "…" : ""}</span>
                  </div>
                )}
                {d.status!=="resolved"&&(
                  <>
                    {(d.ai_decision==="refund"||d.ai_decision==="release")&&<button className={styles.applySuggestionBtn} disabled={!!applyingId} onClick={()=>applySuggestion(d.id,d.ai_decision,d.ai_reasoning)}>{applyingId===d.id?"…":"Apply suggestion"}</button>}
                    <button
                      className={styles.refundBuyerBtn}
                      onClick={() => setRefundTarget(d)}
                      disabled={d.refund_status === "completed" || !!d.refund_txid}
                    >
                      Rule in Buyer's Favour
                    </button>
                    <button className={styles.overrideBtn} onClick={()=>setOverrideId(d.id)}>⚖️ Admin Override</button>
                  </>
                )}
              </div>
            ))}
            {totalPages > 1 && (
              <div className={styles.pager}>
                <button type="button" className={styles.pagerBtn} disabled={pageSafe===1} onClick={()=>setDisputesPage(p=>Math.max(1,p-1))}>← Prev</button>
                <span className={styles.pagerInfo}>Page {pageSafe} of {totalPages}</span>
                <button type="button" className={styles.pagerBtn} disabled={pageSafe===totalPages} onClick={()=>setDisputesPage(p=>Math.min(totalPages,p+1))}>Next →</button>
              </div>
            )}
            </>
              );
            })()}
          </div>
        )}

        {tab === "users" && (
          <div className={styles.section}>
            <div className={styles.filterRow}>
              <input className={styles.searchInput} placeholder="Search username..." value={userQ} onChange={e=>setUserQ(e.target.value)}/>
              <select className={styles.select} value={userFilter} onChange={e=>setUserFilter(e.target.value)}>
                <option value="">All Users</option><option value="banned">Banned</option>
              </select>
            </div>
            <div className={styles.countRow}>{userTotal} users</div>
            {(()=>{
              const totalPages = Math.max(1, Math.ceil(users.length / ADMIN_PAGE_SIZE));
              const pageSafe = Math.min(usersPage, totalPages);
              const pageList = users.slice((pageSafe - 1) * ADMIN_PAGE_SIZE, pageSafe * ADMIN_PAGE_SIZE);
              return (
            <>
            <div className={styles.userList}>
              {pageList.map(u=>(
                <div key={u.id} className={`${styles.userCard} ${u.is_banned?styles.userCardBanned:""}`}>
                  <div className={styles.userAvatar}>{u.avatar_url?<img src={u.avatar_url} alt="" className={styles.userAvatarImg}/>:<span>{getInitial(u.username)}</span>}</div>
                  <div className={styles.userInfo}>
                    <div className={styles.userName}>{u.display_name??u.username}{u.kyc_status==="verified"&&<KycBadge size={14} />}{u.seller_verified&&" 🏪"}{u.is_banned&&<span className={styles.bannedTag}>BANNED</span>}</div>
                    <div className={styles.userSub}>@{u.username} · {u.role} · Joined {fmt(u.created_at)}</div>
                    {u.ban_reason&&<div className={styles.banReason}>Ban: {u.ban_reason}</div>}
                    {userActionMsg[u.id]&&<div className={styles.actionMsg}>{userActionMsg[u.id]}</div>}
                  </div>
                  <div className={styles.userActions}>
                    {!u.seller_verified?<button className={styles.okBtn} onClick={()=>updateUser(u.id,{seller_verified:true},"✅ Verified!")}>Verify Seller</button>:<button className={styles.warnBtn} onClick={()=>updateUser(u.id,{seller_verified:false},"Unverified")}>Unverify</button>}
                    {!u.is_banned?<button className={styles.dangerBtn} onClick={()=>setBanUserId(u.id)}>Ban</button>:<button className={styles.okBtn} onClick={()=>updateUser(u.id,{is_banned:false,ban_reason:null},"✅ Unbanned!")}>Unban</button>}
                    <Link href={`/supaspace/${u.username}`} className={styles.viewProfileBtn}>Profile →</Link>
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className={styles.pager}>
                <button type="button" className={styles.pagerBtn} disabled={pageSafe===1} onClick={()=>setUsersPage(p=>Math.max(1,p-1))}>← Prev</button>
                <span className={styles.pagerInfo}>Page {pageSafe} of {totalPages}</span>
                <button type="button" className={styles.pagerBtn} disabled={pageSafe===totalPages} onClick={()=>setUsersPage(p=>Math.min(totalPages,p+1))}>Next →</button>
              </div>
            )}
            </>
              );
            })()}
          </div>
        )}

        {tab === "commission" && commConfig && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Platform Commission Settings</div>
            <div className={styles.commCard}>
              <div className={styles.commStatGrid}>
                <Stat label="Current Rate"       value={`${commConfig.commission_pct}%`}                         color="#F5A623"/>
                <Stat label="Total Collected"    value={`${Number(commConfig.total_collected_pi).toFixed(4)} π`} color="#27ae60"/>
                <Stat label="Pending Collection" value={`${Number(commConfig.total_pending_pi).toFixed(4)} π`}   color="#f39c12"/>
              </div>
              <div className={styles.commEdit}>
                <div className={styles.commEditTitle}>Update Commission Rate</div>
                <div className={styles.commEditRow}>
                  <input className={styles.commInput} type="number" min="0" max="50" step="0.5" value={commPct} onChange={e=>setCommPct(e.target.value)} placeholder="e.g. 5"/>
                  <span className={styles.commPctLabel}>%</span>
                  <button className={styles.saveCommBtn} onClick={saveCommission} disabled={savingComm}>{savingComm?"Saving...":"Save"}</button>
                </div>
                {commMsg&&<div className={`${styles.commMsg} ${commMsg.includes("✅")?styles.commMsgOk:styles.commMsgErr}`}>{commMsg}</div>}
                <div className={styles.commNote}>Commission deducted from seller payout on completion. Range: 0%–50%.</div>
              </div>
              <div className={styles.commEdit}>
                <div className={styles.commEditTitle}>Export SupaMarket Data</div>
                <div className={styles.exportRow}>
                  {(["orders","listings","commissions"] as const).map((type) => (
                    <button
                      key={type}
                      className={styles.exportBtn}
                      disabled={exporting === type}
                      onClick={() => exportCSV(type)}
                    >
                      {exporting === type ? "⏳ Exporting..." : `📥 ${type.charAt(0).toUpperCase() + type.slice(1)} CSV`}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.commEdit}>
                <div className={styles.commEditTitle}>Reconcile Missing Seller Earnings</div>
                <div className={styles.commNote}>
                  For completed orders that were not credited to seller earnings due to old flow/env mismatch.
                </div>
                <div className={styles.exportRow}>
                  <button
                    className={styles.exportBtn}
                    disabled={reconcileLoading !== null}
                    onClick={() => runEarningsReconcile(false)}
                  >
                    {reconcileLoading === "dry" ? "⏳ Checking..." : "Preview missing earnings"}
                  </button>
                  <button
                    className={styles.exportBtn}
                    disabled={reconcileLoading !== null}
                    onClick={() => runEarningsReconcile(true)}
                  >
                    {reconcileLoading === "run" ? "⏳ Reconciling..." : "Fix missing earnings"}
                  </button>
                </div>
                {reconcileResult && (
                  <pre className={styles.commNote} style={{ whiteSpace: "pre-wrap", marginTop: 10 }}>
{JSON.stringify(reconcileResult, null, 2)}
                  </pre>
                )}
              </div>
              {commConfig.ledger?.length>0&&(<>
                <div className={styles.sectionTitle} style={{marginTop:20}}>Recent Commission Ledger</div>
                <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Date</th><th>Commission (π)</th><th>Status</th></tr></thead>
                <tbody>{commConfig.ledger.slice(0,20).map((c:any,i:number)=>(
                  <tr key={i}><td>{fmt(c.created_at)}</td><td className={styles.piAmt}>{Number(c.commission_pi).toFixed(4)} π</td><td><Badge status={c.status}/></td></tr>
                ))}</tbody></table></div>
              </>)}
            </div>
          </div>
        )}
      </div>

      <div className="adminQuickLinks">
        <Link href="/admin/dashboard" className="adminBackBtn">Back to Dashboard</Link>
      </div>

      {overrideId&&(
        <div className="adminModalOverlay" onClick={()=>!overriding&&setOverrideId(null)}>
          <div className="adminModalSheet" onClick={e=>e.stopPropagation()}>
            <div className="adminModalHandle" />
            <div className="adminModalEmoji">⚖️</div>
            <div className="adminModalTitle">Admin Override</div>
            <div className="adminModalSub">Override dispute resolution</div>
            <label className="adminModalLabel">Decision</label>
            <div className="adminModalChoiceBtns">
              <button className={`adminModalChoiceBtn ${overrideDecision==="refund"?"adminModalChoiceBtnRefund":""}`} onClick={()=>setOverrideDecision("refund")}>↩️ Refund Buyer</button>
              <button className={`adminModalChoiceBtn ${overrideDecision==="release"?"adminModalChoiceBtnRelease":""}`} onClick={()=>setOverrideDecision("release")}>✅ Release to Seller</button>
            </div>
            <label className="adminModalLabel">Reasoning</label>
            <textarea className="adminModalTextarea" rows={3} placeholder="Explain your decision..." value={overrideReason} onChange={e=>setOverrideReason(e.target.value)}/>
            <div className="adminModalBtns">
              <button className="adminModalCancelBtn" onClick={()=>setOverrideId(null)}>Cancel</button>
              <button className="adminModalConfirmBtn" disabled={overriding||!overrideReason.trim()} onClick={overrideDispute}>{overriding?"Processing...":"Confirm Override"}</button>
            </div>
          </div>
        </div>
      )}

      {banUserId&&(
        <div className="adminModalOverlay" onClick={()=>setBanUserId(null)}>
          <div className="adminModalSheet" onClick={e=>e.stopPropagation()}>
            <div className="adminModalHandle" />
            <div className="adminModalEmoji">🚫</div>
            <div className="adminModalTitle">Ban User</div>
            <div className="adminModalSub">User will be restricted from platform access</div>
            <label className="adminModalLabel">Reason</label>
            <textarea className="adminModalTextarea" rows={3} placeholder="Reason for ban..." value={banReason} onChange={e=>setBanReason(e.target.value)}/>
            <div className="adminModalBtns">
              <button className="adminModalCancelBtn" onClick={()=>setBanUserId(null)}>Cancel</button>
              <button className="adminModalDangerBtn" disabled={!banReason.trim()} onClick={()=>updateUser(banUserId,{is_banned:true,ban_reason:banReason},"🚫 Banned")}>Ban User</button>
            </div>
          </div>
        </div>
      )}

      {refundTarget && (
        <div className="adminModalOverlay" onClick={() => !refunding && setRefundTarget(null)}>
          <div className="adminModalSheet" onClick={(e) => e.stopPropagation()}>
            <div className="adminModalHandle" />
            <div className="adminModalEmoji">↩️</div>
            <div className="adminModalTitle">Rule in Buyer's Favour</div>
            <div className="adminModalSub">Send A2U refund to buyer wallet</div>
            {refundSuccess ? (
              <div className="adminModalInfo">
                <div className="adminModalRow">
                  <span className="adminModalRowLabel">Status</span>
                  <span className="adminModalRowValGold">✅ Refund issued</span>
                </div>
                <div className="adminModalRow">
                  <span className="adminModalRowLabel">Amount</span>
                  <span className="adminModalRowVal">{refundSuccess.amount.toFixed(2)} π</span>
                </div>
                <div className="adminModalRow">
                  <span className="adminModalRowLabel">Tx ID</span>
                  <span className="adminModalRowVal" style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>{refundSuccess.txid}</span>
                </div>
              </div>
            ) : (
              <div className="adminModalInfo">
                <div className="adminModalRow">
                  <span className="adminModalRowLabel">Refund amount</span>
                  <span className="adminModalRowValGold">{Number(refundTarget.order?.amount_pi ?? 0).toFixed(2)} π</span>
                </div>
                <div className="adminModalRow">
                  <span className="adminModalRowLabel">Note</span>
                  <span className="adminModalRowVal" style={{ fontSize: 12 }}>Action is idempotent. If already refunded, system returns existing info.</span>
                </div>
              </div>
            )}
            <div className="adminModalBtns">
              <button className="adminModalCancelBtn" onClick={() => setRefundTarget(null)} disabled={refunding}>
                {refundSuccess ? "Close" : "Cancel"}
              </button>
              {!refundSuccess && (
                <button className="adminModalConfirmBtn" onClick={issueBuyerRefund} disabled={refunding}>
                  {refunding ? "Issuing refund..." : "Confirm & Issue Refund"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}