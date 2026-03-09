"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AdminTabs from "@/components/admin/AdminTabs";
import styles from "./page.module.css";

interface Stats {
  listings: { total: number; active: number };
  orders: { total: number; pending: number; completed: number; disputed: number };
  revenue: { total_pi: number; commission_pi: number; commission_pct: number; estimated_commission: number };
  recent_orders: any[];
}
interface Listing { id:string; title:string; price_pi:number; category:string; status:string; stock:number; views:number; created_at:string; images:string[]; seller:{id:string;username:string;display_name:string|null;avatar_url:string|null;kyc_status:string;is_banned:boolean}; }
interface Order   { id:string; status:string; amount_pi:number; buying_method:string; created_at:string; pi_payment_id:string; listing:{id:string;title:string;images:string[]}|null; buyer:{id:string;username:string;display_name:string|null}; seller:{id:string;username:string;display_name:string|null}; }
interface Dispute { id:string; reason:string; status:string; ai_decision:string; ai_reasoning:string; ai_confidence:number; created_at:string; resolved_at:string; opened_by_user:{id:string;username:string;display_name:string|null}; order:{id:string;amount_pi:number;status:string;buyer:{username:string};seller:{username:string};listing:{title:string}}|null; }
interface User    { id:string; username:string; display_name:string|null; avatar_url:string|null; kyc_status:string; role:string; is_banned:boolean; ban_reason:string|null; seller_verified:boolean; created_at:string; last_seen:string|null; }

const STATUS_COLOR: Record<string,string> = {
  active:"#27ae60", paused:"#f39c12", sold:"#7f8c8d", deleted:"#e74c3c",
  pending:"#f39c12", paid:"#27ae60", shipped:"#2980b9", meetup_set:"#8e44ad",
  delivered:"#27ae60", completed:"#27ae60", disputed:"#e74c3c", refunded:"#7f8c8d", cancelled:"#95a5a6",
  open:"#f39c12", ai_reviewing:"#2980b9", resolved:"#27ae60", collected:"#27ae60",
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

export default function AdminMarketPage() {
  const [tab, setTab] = useState<"overview"|"listings"|"orders"|"disputes"|"users"|"commission">("overview");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");
  const [stats, setStats] = useState<Stats|null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [commConfig, setCommConfig] = useState<any>(null);
  const [listQ, setListQ] = useState(""); const [listStatus, setListStatus] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [disputeStatus, setDisputeStatus] = useState("");
  const [userQ, setUserQ] = useState(""); const [userFilter, setUserFilter] = useState("");
  const [commPct, setCommPct] = useState(""); const [savingComm, setSavingComm] = useState(false); const [commMsg, setCommMsg] = useState("");
  const [overrideId, setOverrideId] = useState<string|null>(null);
  const [overrideDecision, setOverrideDecision] = useState<"refund"|"release">("release");
  const [overrideReason, setOverrideReason] = useState(""); const [overriding, setOverriding] = useState(false);
  const [banUserId, setBanUserId] = useState<string|null>(null); const [banReason, setBanReason] = useState("");
  const [userActionMsg, setUserActionMsg] = useState<Record<string,string>>({});

  useEffect(() => { setToken(localStorage.getItem("supapi_admin_token") ?? ""); }, []);

  const adminFetch = useCallback(async (url: string, opts?: RequestInit) =>
    fetch(url, { ...opts, headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}`, ...(opts?.headers??{}) } }), [token]);

  useEffect(() => { if (!token || tab !== "overview") return; setLoading(true); adminFetch("/api/admin/market/stats").then(r=>r.json()).then(d=>{if(d.success)setStats(d.data);}).finally(()=>setLoading(false)); }, [token,tab,adminFetch]);
  useEffect(() => { if (!token || tab !== "listings") return; setLoading(true); adminFetch(`/api/admin/market/listings?q=${listQ}&status=${listStatus}`).then(r=>r.json()).then(d=>{if(d.success){setListings(d.data.listings);setListTotal(d.data.total);}}).finally(()=>setLoading(false)); }, [token,tab,listQ,listStatus,adminFetch]);
  useEffect(() => { if (!token || tab !== "orders") return; setLoading(true); adminFetch(`/api/admin/market/orders?status=${orderStatus}`).then(r=>r.json()).then(d=>{if(d.success){setOrders(d.data.orders);setOrderTotal(d.data.total);}}).finally(()=>setLoading(false)); }, [token,tab,orderStatus,adminFetch]);
  useEffect(() => { if (!token || tab !== "disputes") return; setLoading(true); adminFetch(`/api/admin/market/disputes?status=${disputeStatus}`).then(r=>r.json()).then(d=>{if(d.success)setDisputes(d.data.disputes);}).finally(()=>setLoading(false)); }, [token,tab,disputeStatus,adminFetch]);
  useEffect(() => { if (!token || tab !== "users") return; setLoading(true); adminFetch(`/api/admin/users?q=${userQ}&filter=${userFilter}`).then(r=>r.json()).then(d=>{if(d.success){setUsers(d.data.users??[]);setUserTotal(d.data.total??0);}}).finally(()=>setLoading(false)); }, [token,tab,userQ,userFilter,adminFetch]);
  useEffect(() => { if (!token || tab !== "commission") return; setLoading(true); adminFetch("/api/admin/market/commission").then(r=>r.json()).then(d=>{if(d.success){setCommConfig(d.data);setCommPct(String(d.data.commission_pct));}}).finally(()=>setLoading(false)); }, [token,tab,adminFetch]);

  const suspendListing = async (id: string, status: string) => { await adminFetch(`/api/admin/market/listings/${id}`,{method:"PATCH",body:JSON.stringify({status})}); setListings(prev=>prev.map(l=>l.id===id?{...l,status}:l)); };
  const overrideDispute = async () => { if(!overrideId)return; setOverriding(true); const r=await adminFetch(`/api/admin/market/disputes/${overrideId}`,{method:"PATCH",body:JSON.stringify({decision:overrideDecision,reasoning:overrideReason})}); const d=await r.json(); if(d.success){setDisputes(prev=>prev.map(dp=>dp.id===overrideId?{...dp,ai_decision:overrideDecision,status:"resolved"}:dp));setOverrideId(null);setOverrideReason("");} setOverriding(false); };
  const updateUser = async (userId: string, patch: object, msg: string) => { const r=await adminFetch(`/api/admin/users/${userId}`,{method:"PATCH",body:JSON.stringify(patch)}); const d=await r.json(); if(d.success){setUsers(prev=>prev.map(u=>u.id===userId?{...u,...d.data}:u));setUserActionMsg(prev=>({...prev,[userId]:msg}));setTimeout(()=>setUserActionMsg(prev=>{const n={...prev};delete n[userId];return n;}),2500);} setBanUserId(null);setBanReason(""); };
  const saveCommission = async () => { const pct=parseFloat(commPct); if(isNaN(pct)||pct<0||pct>50){setCommMsg("Enter 0–50");return;} setSavingComm(true); const r=await adminFetch("/api/admin/market/commission",{method:"PATCH",body:JSON.stringify({commission_pct:pct})}); const d=await r.json(); setCommMsg(d.success?"✅ Saved!":"❌ Failed"); if(d.success&&commConfig)setCommConfig({...commConfig,commission_pct:pct}); setTimeout(()=>setCommMsg(""),2500); setSavingComm(false); };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/admin/dashboard" className={styles.backBtn}>← Admin</Link>
        <h1 className={styles.title}>🛍️ Marketplace Admin</h1>
      </div>

      <AdminTabs tabs={TABS} active={tab} onChange={(id) => setTab(id as any)} />

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
              <Stat label="Est. Commission" value={`${stats.revenue.estimated_commission.toFixed(4)} π`} sub={`@ ${stats.revenue.commission_pct}%`} color="#2980b9"/>
            </div>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Recent Orders</div>
              <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Order</th><th>Item</th><th>Buyer</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>{stats.recent_orders.map((o:any)=>(
                <tr key={o.id}><td className={styles.mono}>{o.id.slice(0,8)}…</td><td>{o.listing?.title??"—"}</td><td>@{o.buyer?.username}</td><td className={styles.piAmt}>{Number(o.amount_pi).toFixed(2)} π</td><td>{o.buying_method==="ship"?"📦":"📍"}</td><td><Badge status={o.status}/></td><td>{fmt(o.created_at)}</td></tr>
              ))}</tbody></table></div>
            </div>
          </div>
        )}

        {tab === "listings" && (
          <div className={styles.section}>
            <div className={styles.filterRow}>
              <input className={styles.searchInput} placeholder="Search listings..." value={listQ} onChange={e=>setListQ(e.target.value)}/>
              <select className={styles.select} value={listStatus} onChange={e=>setListStatus(e.target.value)}>
                <option value="">All Status</option>
                {["active","paused","sold","deleted"].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className={styles.countRow}>{listTotal} listings</div>
            <div className={styles.tableWrap}><table className={styles.table}>
              <thead><tr><th>Img</th><th>Title</th><th>Seller</th><th>Price</th><th>Cat</th><th>Stock</th><th>Views</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{listings.map(l=>(
                <tr key={l.id}>
                  <td><div className={styles.thumbCell}>{l.images?.[0]?<img src={l.images[0]} alt="" className={styles.tableThumb}/>:"🛍️"}</div></td>
                  <td><Link href={`/market/${l.id}`} className={styles.link}>{l.title}</Link></td>
                  <td><span className={styles.userCell}>@{l.seller?.username}{l.seller?.kyc_status==="verified"&&" ✅"}{l.seller?.is_banned&&<span className={styles.bannedTag}>BANNED</span>}</span></td>
                  <td className={styles.piAmt}>{Number(l.price_pi).toFixed(2)} π</td><td>{l.category}</td><td>{l.stock}</td><td>{l.views}</td>
                  <td><Badge status={l.status}/></td>
                  <td><div className={styles.actionBtns}>
                    {l.status==="active"&&<button className={styles.warnBtn} onClick={()=>suspendListing(l.id,"paused")}>Pause</button>}
                    {l.status==="paused"&&<button className={styles.okBtn} onClick={()=>suspendListing(l.id,"active")}>Restore</button>}
                    {l.status!=="deleted"&&<button className={styles.dangerBtn} onClick={()=>suspendListing(l.id,"deleted")}>Delete</button>}
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
            <div className={styles.tableWrap}><table className={styles.table}>
              <thead><tr><th>Order ID</th><th>Item</th><th>Buyer</th><th>Seller</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>{orders.map(o=>(
                <tr key={o.id}>
                  <td className={styles.mono}>{o.id.slice(0,8)}…</td><td>{o.listing?.title??"—"}</td>
                  <td>@{o.buyer?.username}</td><td>@{o.seller?.username}</td>
                  <td className={styles.piAmt}>{Number(o.amount_pi).toFixed(2)} π</td>
                  <td>{o.buying_method==="ship"?"📦 Ship":"📍 Meetup"}</td>
                  <td><Badge status={o.status}/></td><td>{fmt(o.created_at)}</td>
                  <td><div className={styles.actionBtns}>
                    {o.status==="disputed"&&<button className={styles.warnBtn} onClick={()=>setOverrideId(o.id)}>Override</button>}
                    {!["completed","refunded","cancelled"].includes(o.status)&&<button className={styles.dangerBtn} onClick={async()=>{await adminFetch(`/api/admin/market/orders/${o.id}`,{method:"PATCH",body:JSON.stringify({status:"cancelled"})});setOrders(prev=>prev.map(x=>x.id===o.id?{...x,status:"cancelled"}:x));}}>Cancel</button>}
                  </div></td>
                </tr>
              ))}</tbody></table></div>
          </div>
        )}

        {tab === "disputes" && (
          <div className={styles.section}>
            <div className={styles.filterRow}>
              <select className={styles.select} value={disputeStatus} onChange={e=>setDisputeStatus(e.target.value)}>
                <option value="">All</option>
                {["open","ai_reviewing","resolved"].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {disputes.length===0&&<div className={styles.empty}>No disputes found 🎉</div>}
            {disputes.map(d=>(
              <div key={d.id} className={styles.disputeCard}>
                <div className={styles.disputeHeader}>
                  <div>
                    <div className={styles.disputeTitle}>{d.order?.listing?.title??"Unknown Item"}</div>
                    <div className={styles.disputeMeta}>@{d.opened_by_user?.username} · {fmt(d.created_at)} · Buyer: @{d.order?.buyer?.username} → Seller: @{d.order?.seller?.username}</div>
                  </div>
                  <div className={styles.disputeRight}><Badge status={d.status}/><div className={styles.piAmt}>{Number(d.order?.amount_pi??0).toFixed(2)} π</div></div>
                </div>
                <div className={styles.disputeReason}><strong>Reason:</strong> {d.reason}</div>
                {d.ai_decision&&<div className={`${styles.aiDecision} ${d.ai_decision==="refund"?styles.aiRefund:styles.aiRelease}`}>
                  <strong>AI:</strong> {d.ai_decision==="refund"?"↩️ Refund":"✅ Release"} · {Math.round((d.ai_confidence??0)*100)}% confidence
                  <div className={styles.aiReasoning}>{d.ai_reasoning}</div>
                </div>}
                {d.status!=="resolved"&&<button className={styles.overrideBtn} onClick={()=>setOverrideId(d.id)}>⚖️ Admin Override</button>}
              </div>
            ))}
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
            <div className={styles.userList}>
              {users.map(u=>(
                <div key={u.id} className={`${styles.userCard} ${u.is_banned?styles.userCardBanned:""}`}>
                  <div className={styles.userAvatar}>{u.avatar_url?<img src={u.avatar_url} alt="" className={styles.userAvatarImg}/>:<span>{getInitial(u.username)}</span>}</div>
                  <div className={styles.userInfo}>
                    <div className={styles.userName}>{u.display_name??u.username}{u.kyc_status==="verified"&&" ✅"}{u.seller_verified&&" 🏪"}{u.is_banned&&<span className={styles.bannedTag}>BANNED</span>}</div>
                    <div className={styles.userSub}>@{u.username} · {u.role} · Joined {fmt(u.created_at)}</div>
                    {u.ban_reason&&<div className={styles.banReason}>Ban: {u.ban_reason}</div>}
                    {userActionMsg[u.id]&&<div className={styles.actionMsg}>{userActionMsg[u.id]}</div>}
                  </div>
                  <div className={styles.userActions}>
                    {!u.seller_verified?<button className={styles.okBtn} onClick={()=>updateUser(u.id,{seller_verified:true},"✅ Verified!")}>Verify Seller</button>:<button className={styles.warnBtn} onClick={()=>updateUser(u.id,{seller_verified:false},"Unverified")}>Unverify</button>}
                    {!u.is_banned?<button className={styles.dangerBtn} onClick={()=>setBanUserId(u.id)}>Ban</button>:<button className={styles.okBtn} onClick={()=>updateUser(u.id,{is_banned:false,ban_reason:null},"✅ Unbanned!")}>Unban</button>}
                    <Link href={`/myspace/${u.username}`} className={styles.viewProfileBtn}>Profile →</Link>
                  </div>
                </div>
              ))}
            </div>
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

      {overrideId&&(
        <div className={styles.modalOverlay} onClick={()=>!overriding&&setOverrideId(null)}>
          <div className={styles.modal} onClick={e=>e.stopPropagation()}>
            <div className={styles.modalTitle}>⚖️ Admin Override</div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Decision</label>
              <div className={styles.decisionBtns}>
                <button className={`${styles.decisionBtn} ${overrideDecision==="refund"?styles.decisionRefund:""}`} onClick={()=>setOverrideDecision("refund")}>↩️ Refund Buyer</button>
                <button className={`${styles.decisionBtn} ${overrideDecision==="release"?styles.decisionRelease:""}`} onClick={()=>setOverrideDecision("release")}>✅ Release to Seller</button>
              </div>
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Reasoning</label>
              <textarea className={styles.modalTextarea} rows={3} placeholder="Explain your decision..." value={overrideReason} onChange={e=>setOverrideReason(e.target.value)}/>
            </div>
            <div className={styles.modalBtns}>
              <button className={styles.modalCancel} onClick={()=>setOverrideId(null)}>Cancel</button>
              <button className={styles.modalConfirm} disabled={overriding||!overrideReason.trim()} onClick={overrideDispute}>{overriding?"Processing...":"Confirm Override"}</button>
            </div>
          </div>
        </div>
      )}

      {banUserId&&(
        <div className={styles.modalOverlay} onClick={()=>setBanUserId(null)}>
          <div className={styles.modal} onClick={e=>e.stopPropagation()}>
            <div className={styles.modalTitle}>🚫 Ban User</div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Reason</label>
              <textarea className={styles.modalTextarea} rows={3} placeholder="Reason for ban..." value={banReason} onChange={e=>setBanReason(e.target.value)}/>
            </div>
            <div className={styles.modalBtns}>
              <button className={styles.modalCancel} onClick={()=>setBanUserId(null)}>Cancel</button>
              <button className={styles.modalDanger} disabled={!banReason.trim()} onClick={()=>updateUser(banUserId,{is_banned:true,ban_reason:banReason},"🚫 Banned")}>Ban User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}