"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminPageHero from "@/components/admin/AdminPageHero";
import AdminTabs from "@/components/admin/AdminTabs";
import styles from "./page.module.css";

export default function PlatformAdminPage() {
  const [tab, setTab] = useState<"overview" | "carousel" | "spotlights" | "autoreposts">("overview");
  const [overview, setOverview] = useState<any | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);

  const typeFromTab = tab === "overview" ? "overview" : tab;

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("supapi_admin_token") ?? "";
    setLoading(true);
    setMsg("");
    try {
      const r = await fetch(`/api/admin/supasifieds/monetization?type=${typeFromTab}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!d.success) {
        setMsg(d.error ?? "Failed to load admin data");
        return;
      }
      if (typeFromTab === "overview") setOverview(d.data ?? null);
      else setRows(d.data ?? []);
    } catch {
      setMsg("Failed to load admin data");
    }
    setLoading(false);
  }, [typeFromTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setActive = async (id: string, isActive: boolean) => {
    const token = localStorage.getItem("supapi_admin_token") ?? "";
    setToggleLoadingId(id);
    try {
      const r = await fetch("/api/admin/supasifieds/monetization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: typeFromTab, id, is_active: isActive }),
      });
      const d = await r.json();
      if (!d.success) {
        setMsg(d.error ?? "Update failed");
        return;
      }
      setRows((prev) => prev.map((x) => (x.id === id ? { ...x, is_active: isActive } : x)));
    } catch {
      setMsg("Update failed");
    }
    setToggleLoadingId(null);
  };

  return (
    <div className={styles.page}>
      <AdminPageHero icon="📋" title="Supasifieds Admin" subtitle="Monetization, campaigns, and promotion controls" showBadge />
      <AdminTabs
        active={tab}
        onChange={(id) => setTab(id as typeof tab)}
        tabs={[
          { id: "overview", label: "📊 Overview" },
          { id: "carousel", label: "🎠 Carousel Ads" },
          { id: "spotlights", label: "⭐ Spotlights" },
          { id: "autoreposts", label: "🔁 Auto-Repost" },
        ]}
      />

      <div className={styles.actions}>
        <button className={styles.refreshBtn} onClick={fetchData}>
          Refresh
        </button>
        <Link href="/supasifieds/carousel" className={styles.quickLink}>
          Open seller carousel creator
        </Link>
      </div>

      {msg && <div className={styles.msg}>{msg}</div>}
      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : (
        <>
          {tab === "overview" && overview && (
            <div className={styles.grid}>
              <div className={styles.card}><div className={styles.k}>Active listings</div><div className={styles.v}>{overview.active_listings ?? 0}</div></div>
              <div className={styles.card}><div className={styles.k}>Boosted listings</div><div className={styles.v}>{overview.boosted_listings ?? 0}</div></div>
              <div className={styles.card}><div className={styles.k}>Active carousel</div><div className={styles.v}>{overview.active_carousel ?? 0}</div></div>
              <div className={styles.card}><div className={styles.k}>Active spotlights</div><div className={styles.v}>{overview.active_spotlights ?? 0}</div></div>
              <div className={styles.card}><div className={styles.k}>Active auto-repost</div><div className={styles.v}>{overview.active_autoreposts ?? 0}</div></div>
              <div className={styles.card}><div className={styles.k}>Recent monetization (SC)</div><div className={styles.v}>{overview.monetization_sc_spend_recent ?? 0}</div></div>
            </div>
          )}

          {tab !== "overview" && (
            <div className={styles.list}>
              {rows.map((row) => (
                <div key={row.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    {tab === "carousel" && row.image_url ? <img src={row.image_url} alt="" className={styles.thumb} /> : null}
                    <div className={styles.rowInfo}>
                      <div className={styles.rowTitle}>
                        {tab === "carousel"
                          ? row.headline
                          : tab === "spotlights"
                            ? `${row.category} spotlight`
                            : `Every ${row.interval_hours}h auto-repost`}
                      </div>
                      <div className={styles.rowMeta}>
                        ID: {row.id.slice(0, 8)}... · SC {row.sc_cost} · ends {new Date(row.expires_at).toLocaleString()}
                      </div>
                      {tab === "carousel" && row.link_url ? (
                        <Link href={row.link_url} target={row.link_url.startsWith("http") ? "_blank" : undefined} className={styles.link}>
                          {row.link_url}
                        </Link>
                      ) : null}
                      {tab === "autoreposts" && row.next_run_at ? (
                        <div className={styles.rowMeta}>Next run: {new Date(row.next_run_at).toLocaleString()} · Runs: {row.runs_count ?? 0}</div>
                      ) : null}
                    </div>
                  </div>
                  <button
                    className={styles.toggleBtn}
                    onClick={() => setActive(row.id, !row.is_active)}
                    disabled={toggleLoadingId === row.id}
                  >
                    {toggleLoadingId === row.id ? "..." : row.is_active ? "Pause" : "Activate"}
                  </button>
                </div>
              ))}
              {rows.length === 0 && <div className={styles.empty}>No records found.</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}