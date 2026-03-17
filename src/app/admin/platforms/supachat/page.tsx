"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminPageHero from "@/components/admin/AdminPageHero";
import styles from "./page.module.css";

type CommissionConfig = {
  commission_pct: number;
  total_commission_pi: number;
  room_entry_commission_pct?: number;
  total_room_entry_commission_pi?: number;
};

type SupaChatRevenueData = {
  total_pi: number;
  by_type: Record<string, number>;
  by_day: Record<string, number>;
  top_rooms: Array<{ room_id: string; room_name: string; amount_pi: number }>;
  active_verified_badges: number;
  active_promotions: number;
};

type SupaChatModerationData = {
  logs: Array<{
    id: string;
    user_id: string;
    room_id: string | null;
    message_content: string;
    violation_category: string;
    action_taken: string;
    reasoning?: string | null;
    created_at: string;
    user?: { username?: string; display_name?: string | null } | null;
    room?: { name?: string } | null;
  }>;
  sanctions: Array<{
    id: string;
    user_id: string;
    type: string;
    reason: string | null;
    expires_at: string | null;
    created_at: string;
  }>;
  stats: {
    total_violations_today: number;
    top_categories: Array<{ category: string; count: number }>;
    most_sanctioned_users: Array<{ user_id: string; count: number; user?: { username?: string } | null }>;
  };
  rooms: Array<{ id: string; name: string }>;
  strike_history: Array<{
    id: string;
    violation_category: string;
    reason: string;
    created_at: string;
  }>;
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}

async function safeFetch(url: string, token: string): Promise<any> {
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const text = await r.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function AdminSupaChatPage() {
  const [token, setToken] = useState("");
  const [config, setConfig] = useState<CommissionConfig | null>(null);
  const [roomEntryCommPct, setRoomEntryCommPct] = useState("");
  const [savingRoomEntry, setSavingRoomEntry] = useState(false);
  const [supaChatRevenue, setSupaChatRevenue] = useState<SupaChatRevenueData | null>(null);
  const [supaChatModeration, setSupaChatModeration] = useState<SupaChatModerationData | null>(null);
  const [period, setPeriod] = useState<"all" | "month" | "week">("all");
  const [moderationCategory, setModerationCategory] = useState("");
  const [moderationRoomId, setModerationRoomId] = useState("");
  const [moderationFrom, setModerationFrom] = useState("");
  const [moderationTo, setModerationTo] = useState("");
  const [historyUserId, setHistoryUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [commPct, setCommPct] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem("supapi_admin_token") ?? "");
  }, []);

  const fetchAll = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [commRes, revRes, modRes] = await Promise.all([
        fetch("/api/admin/supachat/commission", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        safeFetch(`/api/admin/supachat/revenue?period=${period}`, token),
        safeFetch(
          `/api/admin/supachat/moderation?category=${encodeURIComponent(moderationCategory)}&roomId=${encodeURIComponent(moderationRoomId)}&from=${encodeURIComponent(moderationFrom)}&to=${encodeURIComponent(moderationTo)}&userId=${encodeURIComponent(historyUserId)}`,
          token
        ),
      ]);
      if (commRes?.success) {
        setConfig(commRes.data);
        setCommPct(String(commRes.data.commission_pct));
        setRoomEntryCommPct(String(commRes.data.room_entry_commission_pct ?? "20"));
      }
      if (revRes?.success) setSupaChatRevenue(revRes.data);
      if (modRes?.success) setSupaChatModeration(modRes.data);
    } catch {
      setMsg("Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchAll();
  }, [token, period, moderationCategory, moderationRoomId, moderationFrom, moderationTo, historyUserId]);

  const saveCommission = async () => {
    if (!token || saving) return;
    const pct = parseFloat(commPct);
    if (isNaN(pct) || pct < 0 || pct > 50) {
      setMsg("Invalid commission (0–50%)");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const r = await fetch("/api/admin/supachat/commission", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ commission_pct: pct }),
      });
      const d = await r.json();
      if (d.success) {
        setMsg("✅ Commission updated");
        setConfig((prev) => (prev ? { ...prev, commission_pct: pct } : null));
      } else setMsg(`❌ ${d.error ?? "Failed"}`);
    } catch {
      setMsg("❌ Request failed");
    } finally {
      setSaving(false);
    }
  };

  const saveRoomEntryCommission = async () => {
    if (!token || savingRoomEntry) return;
    const pct = parseFloat(roomEntryCommPct);
    if (isNaN(pct) || pct < 0 || pct > 50) {
      setMsg("Invalid room entry commission (0–50%)");
      return;
    }
    setSavingRoomEntry(true);
    setMsg("");
    try {
      const r = await fetch("/api/admin/supachat/commission", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ room_entry_commission_pct: pct }),
      });
      const d = await r.json();
      if (d.success) {
        setMsg("✅ Room entry commission updated");
        setConfig((prev) => (prev ? { ...prev, room_entry_commission_pct: pct } : null));
      } else setMsg(`❌ ${d.error ?? "Failed"}`);
    } catch {
      setMsg("❌ Request failed");
    } finally {
      setSavingRoomEntry(false);
    }
  };

  const exportSupaChatRevenueCsv = async () => {
    if (!token) return;
    try {
      const r = await fetch(`/api/admin/supachat/revenue/export?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        setMsg("Failed to export SupaChat revenue CSV.");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `supachat-revenue-${period}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setMsg("Failed to export SupaChat revenue CSV.");
    }
  };

  const liftSanction = async (sanctionId: string) => {
    if (!token) return;
    const r = await fetch("/api/admin/supachat/moderation", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sanctionId }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.success) {
      setMsg(`❌ ${d?.error ?? "Failed to lift sanction"}`);
      return;
    }
    setMsg("✅ Sanction lifted");
    const refreshed = await safeFetch(
      `/api/admin/supachat/moderation?category=${encodeURIComponent(moderationCategory)}&roomId=${encodeURIComponent(moderationRoomId)}&from=${encodeURIComponent(moderationFrom)}&to=${encodeURIComponent(moderationTo)}&userId=${encodeURIComponent(historyUserId)}`,
      token
    );
    if (refreshed?.success) setSupaChatModeration(refreshed.data);
  };

  return (
    <div className="adminPage">
      <AdminPageHero
        icon="💬"
        title="SupaChat"
        subtitle="Commission, revenue, and moderation"
      />

      {!!msg && <div className={styles.msg}>{msg}</div>}

      <section className="adminSection">
        <h2 className={styles.sectionTitle}>Transfer Commission</h2>
        <p className={styles.sectionDesc}>
          Commission deducted from Pi tips sent via DM, room tips, and SupaSpace tips. Recipient receives net amount after commission.
        </p>
        {loading ? (
          <div className={styles.empty}>Loading…</div>
        ) : config ? (
          <div className={styles.commCard}>
            <div className={styles.commStatGrid}>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{config.commission_pct}%</span>
                <span className={styles.statLabel}>Current rate</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{Number(config.total_commission_pi).toFixed(4)} π</span>
                <span className={styles.statLabel}>Total collected</span>
              </div>
            </div>
            <div className={styles.commEdit}>
              <div className={styles.commEditTitle}>Update Commission Rate</div>
              <div className={styles.commEditRow}>
                <input
                  className={styles.commInput}
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  value={commPct}
                  onChange={(e) => setCommPct(e.target.value)}
                  placeholder="e.g. 2"
                />
                <span className={styles.commPctLabel}>%</span>
                <button className={styles.saveBtn} onClick={saveCommission} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
              <div className={styles.commNote}>Range: 0%–50%. Applied to all SupaChat Pi transfers.</div>
            </div>
            <div className={styles.commEdit} style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
                <div className={styles.commEditTitle}>Room Entry Commission (paid rooms)</div>
                <div className={styles.commStatGrid} style={{ marginBottom: 10 }}>
                  <div className={styles.statItem}>
                    <span className={styles.statValue}>{config.room_entry_commission_pct ?? 20}%</span>
                    <span className={styles.statLabel}>Current rate</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statValue}>{Number(config.total_room_entry_commission_pi ?? 0).toFixed(4)} π</span>
                    <span className={styles.statLabel}>Total collected</span>
                  </div>
                </div>
                <div className={styles.commEditRow}>
                  <input
                    className={styles.commInput}
                    type="number"
                    min="0"
                    max="50"
                    step="0.5"
                    value={roomEntryCommPct}
                    onChange={(e) => setRoomEntryCommPct(e.target.value)}
                    placeholder="e.g. 20"
                  />
                  <span className={styles.commPctLabel}>%</span>
                  <button className={styles.saveBtn} onClick={saveRoomEntryCommission} disabled={savingRoomEntry}>
                    {savingRoomEntry ? "Saving…" : "Save"}
                  </button>
                </div>
                <div className={styles.commNote}>Platform fee deducted from paid room entry fee. Range: 0%–50%.</div>
              </div>
          </div>
        ) : (
          <div className={styles.empty}>No config loaded</div>
        )}
      </section>

      <section className="adminSection">
        <div className={styles.sectionRow}>
          <h2 className={styles.sectionTitle}>SupaChat Revenue</h2>
          <div className={styles.sectionActions}>
            <div className={styles.periodWrap}>
              <button className={`${styles.periodBtn} ${period === "week" ? styles.periodBtnActive : ""}`} onClick={() => setPeriod("week")}>7d</button>
              <button className={`${styles.periodBtn} ${period === "month" ? styles.periodBtnActive : ""}`} onClick={() => setPeriod("month")}>Month</button>
              <button className={`${styles.periodBtn} ${period === "all" ? styles.periodBtnActive : ""}`} onClick={() => setPeriod("all")}>All</button>
            </div>
            <button type="button" className={styles.seeAllBtn} onClick={exportSupaChatRevenueCsv}>
              Export CSV
            </button>
            <Link href="/supachat" className={styles.seeAll}>Open SupaChat →</Link>
          </div>
        </div>
        {!supaChatRevenue ? (
          <div className={styles.loading}>Loading SupaChat revenue...</div>
        ) : (
          <>
            <div className={styles.referralGrid}>
              <div className={styles.treasuryCard}>
                <div className={styles.treasuryLabel}>Total Revenue</div>
                <div className={styles.treasuryValue}>{Number(supaChatRevenue.total_pi ?? 0).toFixed(4)} π</div>
              </div>
              <div className={styles.treasuryCard}>
                <div className={styles.treasuryLabel}>Active Verified Badges</div>
                <div className={styles.treasuryValue}>{Number(supaChatRevenue.active_verified_badges ?? 0).toFixed(0)}</div>
              </div>
              <div className={styles.treasuryCard}>
                <div className={styles.treasuryLabel}>Active Promotions</div>
                <div className={styles.treasuryValue}>{Number(supaChatRevenue.active_promotions ?? 0).toFixed(0)}</div>
              </div>
              <div className={styles.treasuryCard}>
                <div className={styles.treasuryLabel}>Transfer Commission</div>
                <div className={styles.treasuryValue}>{Number(supaChatRevenue.by_type?.transfer_commission ?? 0).toFixed(4)} π</div>
              </div>
            </div>
            <div className={styles.splitGrid}>
              <div className={styles.panel}>
                <div className={styles.panelTitle}>Revenue Breakdown</div>
                {Object.entries(supaChatRevenue.by_type ?? {}).length ? (
                  Object.entries(supaChatRevenue.by_type)
                    .sort((a, b) => Number(b[1]) - Number(a[1]))
                    .map(([k, v]) => (
                      <div key={k} className={styles.row}>
                        <div className={styles.rowInfo}>
                          <div className={styles.rowTitle}>{k}</div>
                        </div>
                        <span className={styles.badge}>{Number(v).toFixed(4)} π</span>
                      </div>
                    ))
                ) : <div className={styles.empty}>No SupaChat revenue yet</div>}
              </div>
              <div className={styles.panel}>
                <div className={styles.panelTitle}>Top Revenue Rooms</div>
                {supaChatRevenue.top_rooms?.length ? (
                  supaChatRevenue.top_rooms.map((r) => (
                    <div key={r.room_id} className={styles.row}>
                      <div className={styles.rowInfo}>
                        <div className={styles.rowTitle}>{r.room_name}</div>
                      </div>
                      <span className={styles.badge}>{Number(r.amount_pi).toFixed(4)} π</span>
                    </div>
                  ))
                ) : <div className={styles.empty}>No room revenue yet</div>}
              </div>
            </div>
          </>
        )}
      </section>

      <section className="adminSection">
        <div className={styles.sectionRow}>
          <h2 className={styles.sectionTitle}>SupaChat Moderation</h2>
        </div>
        {!supaChatModeration ? (
          <div className={styles.loading}>Loading moderation data...</div>
        ) : (
          <>
            <div className={styles.referralGrid}>
              <div className={styles.treasuryCard}>
                <div className={styles.treasuryLabel}>Violations Today</div>
                <div className={styles.treasuryValueWarn}>{Number(supaChatModeration.stats?.total_violations_today ?? 0).toFixed(0)}</div>
              </div>
              <div className={styles.treasuryCard}>
                <div className={styles.treasuryLabel}>Top Category</div>
                <div className={styles.treasuryValue}>
                  {supaChatModeration.stats?.top_categories?.[0]?.category ?? "—"}
                </div>
              </div>
              <div className={styles.treasuryCard}>
                <div className={styles.treasuryLabel}>Sanctioned Users (Shown)</div>
                <div className={styles.treasuryValue}>{Number(supaChatModeration.sanctions?.length ?? 0).toFixed(0)}</div>
              </div>
              <div className={styles.treasuryCard}>
                <div className={styles.treasuryLabel}>Most Flagged User</div>
                <div className={styles.treasuryValue}>
                  @{supaChatModeration.stats?.most_sanctioned_users?.[0]?.user?.username ?? "—"}
                </div>
              </div>
            </div>

            <div className={styles.filterGrid}>
              <input
                className={styles.filterInput}
                placeholder="Filter category"
                value={moderationCategory}
                onChange={(e) => setModerationCategory(e.target.value)}
              />
              <select className={styles.filterInput} value={moderationRoomId} onChange={(e) => setModerationRoomId(e.target.value)}>
                <option value="">All rooms</option>
                {(supaChatModeration.rooms ?? []).map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <input className={styles.filterInput} type="date" value={moderationFrom} onChange={(e) => setModerationFrom(e.target.value)} />
              <input className={styles.filterInput} type="date" value={moderationTo} onChange={(e) => setModerationTo(e.target.value)} />
            </div>

            <div className={styles.splitGrid}>
              <div className={styles.panel}>
                <div className={styles.panelTitle}>Recent Violations</div>
                {(supaChatModeration.logs ?? []).length ? (
                  supaChatModeration.logs.map((l) => (
                    <div key={l.id} className={styles.row}>
                      <div className={styles.rowInfo}>
                        <div className={styles.rowTitle}>
                          @{l.user?.username ?? l.user_id.slice(0, 8)} · {l.violation_category}
                        </div>
                        <div className={styles.rowSub}>
                          {l.message_content.slice(0, 80)} · {l.room?.name ? `#${l.room.name}` : "DM"} · {fmtDate(l.created_at)}
                          {l.reasoning ? ` · ${l.reasoning}` : ""}
                        </div>
                      </div>
                      <div className={styles.rowActions}>
                        <span className={styles.badge}>{l.action_taken}</span>
                        <button className={styles.okBtn} onClick={() => setHistoryUserId(l.user_id)}>View History</button>
                      </div>
                    </div>
                  ))
                ) : <div className={styles.empty}>No violations found</div>}
              </div>

              <div className={styles.panel}>
                <div className={styles.panelTitle}>Active Sanctions</div>
                {(supaChatModeration.sanctions ?? []).length ? (
                  supaChatModeration.sanctions.map((s) => (
                    <div key={s.id} className={styles.row}>
                      <div className={styles.rowInfo}>
                        <div className={styles.rowTitle}>User {s.user_id.slice(0, 8)} · {s.type}</div>
                        <div className={styles.rowSub}>
                          {s.reason ?? "—"} · {s.expires_at ? `until ${fmtDate(s.expires_at)}` : "permanent"}
                        </div>
                      </div>
                      <button className={styles.dangerBtn} onClick={() => liftSanction(s.id)}>Lift Ban</button>
                    </div>
                  ))
                ) : <div className={styles.empty}>No active sanctions</div>}
              </div>
            </div>

            {historyUserId ? (
              <div className={styles.panel}>
                <div className={styles.panelTitle}>Strike History · {historyUserId.slice(0, 8)}</div>
                {supaChatModeration.strike_history?.length ? (
                  supaChatModeration.strike_history.map((h) => (
                    <div key={h.id} className={styles.row}>
                      <div className={styles.rowInfo}>
                        <div className={styles.rowTitle}>{h.violation_category}</div>
                        <div className={styles.rowSub}>{h.reason} · {fmtDate(h.created_at)}</div>
                      </div>
                    </div>
                  ))
                ) : <div className={styles.empty}>No strikes for selected user</div>}
              </div>
            ) : null}
          </>
        )}
      </section>

      <div className="adminQuickLinks">
        <Link href="/admin/dashboard" className="adminBackBtn">Back to Dashboard</Link>
      </div>
    </div>
  );
}
