"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminPageHero from "@/components/admin/AdminPageHero";
import AdminTabs from "@/components/admin/AdminTabs";
import styles from "./page.module.css";

export default function PlatformAdminPage() {
  const [tab, setTab] = useState<"overview" | "pricing" | "carousel" | "spotlights" | "autoreposts">("overview");
  const [overview, setOverview] = useState<any | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [pricing, setPricing] = useState<{
    boostTiers: Record<string, { sc: number; hrs: number; label: string }>;
    carouselPackages: Array<{ days: number; sc: number; label: string }>;
    spotlightPackages: Array<{ days: number; sc: number; label: string }>;
    autorepostPackages: Array<{ id: string; interval_hours: number; days: number; sc: number; label: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [savingPricing, setSavingPricing] = useState(false);
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
      else if (typeFromTab === "pricing") setPricing(d.data ?? null);
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

  const updateBoostField = (tier: "bronze" | "silver" | "gold", field: "sc" | "hrs" | "label", value: string) => {
    setPricing((prev) => {
      if (!prev) return prev;
      const next = { ...prev, boostTiers: { ...prev.boostTiers, [tier]: { ...prev.boostTiers[tier] } } };
      if (field === "label") next.boostTiers[tier].label = value;
      else next.boostTiers[tier][field] = Math.max(1, Number(value || "0"));
      return next;
    });
  };

  const updateCarouselField = (idx: number, field: "days" | "sc" | "label", value: string) => {
    setPricing((prev) => {
      if (!prev) return prev;
      const nextRows = prev.carouselPackages.map((row, i) => (i === idx ? { ...row } : row));
      if (!nextRows[idx]) return prev;
      if (field === "label") nextRows[idx].label = value;
      else nextRows[idx][field] = Math.max(1, Number(value || "0"));
      return { ...prev, carouselPackages: nextRows };
    });
  };

  const updateSpotlightField = (idx: number, field: "days" | "sc" | "label", value: string) => {
    setPricing((prev) => {
      if (!prev) return prev;
      const nextRows = prev.spotlightPackages.map((row, i) => (i === idx ? { ...row } : row));
      if (!nextRows[idx]) return prev;
      if (field === "label") nextRows[idx].label = value;
      else nextRows[idx][field] = Math.max(1, Number(value || "0"));
      return { ...prev, spotlightPackages: nextRows };
    });
  };

  const updateAutorepostField = (
    idx: number,
    field: "id" | "interval_hours" | "days" | "sc" | "label",
    value: string
  ) => {
    setPricing((prev) => {
      if (!prev) return prev;
      const nextRows = prev.autorepostPackages.map((row, i) => (i === idx ? { ...row } : row));
      if (!nextRows[idx]) return prev;
      if (field === "id" || field === "label") {
        nextRows[idx][field] = value;
      } else {
        nextRows[idx][field] = Math.max(1, Number(value || "0"));
      }
      return { ...prev, autorepostPackages: nextRows };
    });
  };

  const savePricing = async () => {
    if (!pricing) return;
    const token = localStorage.getItem("supapi_admin_token") ?? "";
    setSavingPricing(true);
    setMsg("");
    try {
      const r = await fetch("/api/admin/supasifieds/monetization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: "pricing",
          boostTiers: pricing.boostTiers,
          carouselPackages: pricing.carouselPackages,
          spotlightPackages: pricing.spotlightPackages,
          autorepostPackages: pricing.autorepostPackages,
        }),
      });
      const d = await r.json();
      if (!d.success) {
        setMsg(d.error ?? "Failed to save pricing");
      } else {
        setPricing(d.data ?? pricing);
        setMsg("Pricing saved");
      }
    } catch {
      setMsg("Failed to save pricing");
    }
    setSavingPricing(false);
  };

  return (
    <div className={styles.page}>
      <AdminPageHero icon="📋" title="Supasifieds Admin" subtitle="Monetization, campaigns, and promotion controls" showBadge />
      <AdminTabs
        active={tab}
        onChange={(id) => setTab(id as typeof tab)}
        tabs={[
          { id: "overview", label: "📊 Overview" },
          { id: "pricing", label: "💸 Pricing" },
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

          {tab === "pricing" && pricing && (
            <div className={styles.pricingWrap}>
              <div className={styles.pricingCard}>
                <div className={styles.pricingHead}>
                  <div>
                    <div className={styles.pricingTitle}>Boost tiers</div>
                    <div className={styles.pricingHint}>Set SC cost, duration, and display label shown to sellers.</div>
                  </div>
                </div>
                <div className={styles.pricingRowHeader}>
                  <span>Tier</span>
                  <span>SC</span>
                  <span>Hours</span>
                  <span>Label</span>
                </div>
                {(["bronze", "silver", "gold"] as const).map((tier) => (
                  <div key={tier} className={styles.pricingRow}>
                    <div className={styles.pricingTier}>{tier}</div>
                    <input
                      className={styles.input}
                      type="number"
                      min={1}
                      value={pricing.boostTiers[tier]?.sc ?? 1}
                      onChange={(e) => updateBoostField(tier, "sc", e.target.value)}
                      placeholder="SC"
                    />
                    <input
                      className={styles.input}
                      type="number"
                      min={1}
                      value={pricing.boostTiers[tier]?.hrs ?? 1}
                      onChange={(e) => updateBoostField(tier, "hrs", e.target.value)}
                      placeholder="Hours"
                    />
                    <input
                      className={styles.inputWide}
                      value={pricing.boostTiers[tier]?.label ?? ""}
                      onChange={(e) => updateBoostField(tier, "label", e.target.value)}
                      placeholder="Label"
                    />
                  </div>
                ))}
                <button className={styles.saveBtn} onClick={savePricing} disabled={savingPricing}>
                  {savingPricing ? "Saving..." : "Save pricing"}
                </button>
              </div>

              <div className={styles.pricingCard}>
                <div className={styles.pricingHead}>
                  <div>
                    <div className={styles.pricingTitle}>Carousel packages</div>
                    <div className={styles.pricingHint}>Configure available campaign durations and SC pricing.</div>
                  </div>
                </div>
                <div className={styles.pricingRowHeaderNoTier}>
                  <span>Days</span>
                  <span>SC</span>
                  <span>Label</span>
                </div>
                {pricing.carouselPackages.map((pkg, idx) => (
                  <div key={`${pkg.days}-${idx}`} className={styles.pricingRowNoTier}>
                    <input
                      className={styles.input}
                      type="number"
                      min={1}
                      value={pkg.days}
                      onChange={(e) => updateCarouselField(idx, "days", e.target.value)}
                      placeholder="Days"
                    />
                    <input
                      className={styles.input}
                      type="number"
                      min={1}
                      value={pkg.sc}
                      onChange={(e) => updateCarouselField(idx, "sc", e.target.value)}
                      placeholder="SC"
                    />
                    <input
                      className={styles.inputWide}
                      value={pkg.label}
                      onChange={(e) => updateCarouselField(idx, "label", e.target.value)}
                      placeholder="Label"
                    />
                  </div>
                ))}
                <button className={styles.saveBtn} onClick={savePricing} disabled={savingPricing}>
                  {savingPricing ? "Saving..." : "Save pricing"}
                </button>
              </div>

              <div className={styles.pricingCard}>
                <div className={styles.pricingHead}>
                  <div>
                    <div className={styles.pricingTitle}>Spotlight packages</div>
                    <div className={styles.pricingHint}>Pricing for category spotlight campaigns.</div>
                  </div>
                </div>
                <div className={styles.pricingRowHeaderNoTier}>
                  <span>Days</span>
                  <span>SC</span>
                  <span>Label</span>
                </div>
                {pricing.spotlightPackages.map((pkg, idx) => (
                  <div key={`${pkg.days}-${idx}`} className={styles.pricingRowNoTier}>
                    <input className={styles.input} type="number" min={1} value={pkg.days} onChange={(e) => updateSpotlightField(idx, "days", e.target.value)} />
                    <input className={styles.input} type="number" min={1} value={pkg.sc} onChange={(e) => updateSpotlightField(idx, "sc", e.target.value)} />
                    <input className={styles.inputWide} value={pkg.label} onChange={(e) => updateSpotlightField(idx, "label", e.target.value)} />
                  </div>
                ))}
                <button className={styles.saveBtn} onClick={savePricing} disabled={savingPricing}>
                  {savingPricing ? "Saving..." : "Save pricing"}
                </button>
              </div>

              <div className={styles.pricingCard}>
                <div className={styles.pricingHead}>
                  <div>
                    <div className={styles.pricingTitle}>Auto-repost packages</div>
                    <div className={styles.pricingHint}>Set package id, interval, duration, and SC cost.</div>
                  </div>
                </div>
                <div className={styles.pricingRowHeaderAuto}>
                  <span>Package ID</span>
                  <span>Interval (h)</span>
                  <span>Days</span>
                  <span>SC</span>
                  <span>Label</span>
                </div>
                {pricing.autorepostPackages.map((pkg, idx) => (
                  <div key={`${pkg.id}-${idx}`} className={styles.pricingRowAuto}>
                    <input className={styles.input} value={pkg.id} onChange={(e) => updateAutorepostField(idx, "id", e.target.value)} />
                    <input className={styles.input} type="number" min={1} value={pkg.interval_hours} onChange={(e) => updateAutorepostField(idx, "interval_hours", e.target.value)} />
                    <input className={styles.input} type="number" min={1} value={pkg.days} onChange={(e) => updateAutorepostField(idx, "days", e.target.value)} />
                    <input className={styles.input} type="number" min={1} value={pkg.sc} onChange={(e) => updateAutorepostField(idx, "sc", e.target.value)} />
                    <input className={styles.inputWide} value={pkg.label} onChange={(e) => updateAutorepostField(idx, "label", e.target.value)} />
                  </div>
                ))}
                <button className={styles.saveBtn} onClick={savePricing} disabled={savingPricing}>
                  {savingPricing ? "Saving..." : "Save pricing"}
                </button>
              </div>
            </div>
          )}

          {tab !== "overview" && tab !== "pricing" && (
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