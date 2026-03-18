"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import KycBadge from "@/components/ui/KycBadge";
import { useRouter } from "next/navigation";
import { CountrySelect } from "@/components/CountrySelect";
import styles from "./page.module.css";

// ── Constants ──────────────────────────────────────────────────────────────
const VEHICLE_TYPES = [
  { id: "all",        emoji: "🚘", label: "All"        },
  { id: "car",        emoji: "🚗", label: "Cars"       },
  { id: "suv",        emoji: "🚙", label: "SUVs"       },
  { id: "van",        emoji: "🚐", label: "Vans"       },
  { id: "motorcycle", emoji: "🏍️", label: "Motos"     },
  { id: "truck",      emoji: "🚚", label: "Trucks"     },
  { id: "scooter",    emoji: "🛵", label: "Scooters"   },
  { id: "bicycle",    emoji: "🚲", label: "Bicycles"   },
  { id: "boat",       emoji: "⛵", label: "Boats"      },
];

const SORT_OPTIONS = [
  { id: "popular",    label: "Most Booked"  },
  { id: "rating",     label: "Top Rated"    },
  { id: "newest",     label: "Newest"       },
  { id: "price_asc",  label: "Price ↑"      },
  { id: "price_desc", label: "Price ↓"      },
];

const HOST_TIERS: Record<string, { label: string; icon: string; color: string }> = {
  new:     { label: "New Host",    icon: "🔑", color: "#718096" },
  trusted: { label: "Trusted",     icon: "⭐", color: "#D69E2E" },
  super:   { label: "Super Host",  icon: "💎", color: "#6B46C1" },
  elite:   { label: "Elite Host",  icon: "👑", color: "#C05621" },
};

const HOW_IT_WORKS = [
  { step: "01", icon: "🔍", title: "Find Your Ride",    desc: "Browse vehicles by type, dates and location. Filter by Instant Book for immediate confirmation." },
  { step: "02", icon: "📅", title: "Book & Pay in Pi",  desc: "Select your dates. Pay rental + refundable deposit in Pi. Funds held safely in escrow." },
  { step: "03", icon: "🤝", title: "Pick Up & Drive",   desc: "Meet host at pickup point. Confirm handover with photos. Your adventure begins." },
  { step: "04", icon: "🎉", title: "Return & Review",   desc: "Return vehicle, host confirms condition, deposit released. Both earn SC rewards." },
];

function formatPi(n: number) {
  if (!n) return "—";
  if (n >= 1000) return `π ${(n / 1000).toFixed(1)}K`;
  return `π ${n.toLocaleString()}`;
}

function getInitial(s: string) { return (s ?? "?").charAt(0).toUpperCase(); }

interface Vehicle {
  id: string; host_id: string; vehicle_type: string;
  make: string; model: string; year: number | null;
  color: string; seats: number; transmission: string;
  fuel_type: string; images: string[]; location: string;
  instant_book: boolean; delivery_available: boolean;
  daily_rate_pi: number; deposit_pi: number;
  rating: number; review_count: number; booking_count: number;
  host_tier: string; status: string; created_at: string;
  host?: { username: string; display_name: string; avatar_url: string | null; kyc_status: string };
}

// ── Component ──────────────────────────────────────────────────────────────
export default function EndoroPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [homeData, setHomeData]     = useState<any>(null);
  const [vehicles, setVehicles]     = useState<Vehicle[]>([]);
  const [loading, setLoading]       = useState(true);
  const [browsing, setBrowsing]     = useState(false);
  const [vehicleType, setVehicleType] = useState("all");
  const [sort, setSort]             = useState("popular");
  const [searchQ, setSearchQ]       = useState("");
  const [country, setCountry]       = useState("MY");
  const [startDate, setStartDate]   = useState("");
  const [endDate, setEndDate]       = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [instantOnly, setInstantOnly] = useState(false);
  const [filters, setFilters]       = useState({ transmission: "", min_price: "", max_price: "" });
  const [savedIds, setSavedIds]     = useState<Set<string>>(new Set());
  const [toast, setToast]           = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [activeSection, setActiveSection] = useState<"browse" | "how">("browse");

  const token = () => typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "";

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetch("/api/geo").then((r) => r.json()).then((d) => {
      if (d.success) setCountry(d.data.code);
    }).catch(() => {});
  }, []);

  const fetchHome = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ mode: "home", country });
      const r = await fetch(`/api/supaendoro?${params}`);
      const d = await r.json();
      if (d.success) setHomeData(d.data);
    } catch {}
    setLoading(false);
  }, [country]);

  const fetchVehicles = useCallback(async () => {
    setBrowsing(true);
    try {
      const params = new URLSearchParams({
        mode: "browse", vehicle_type: vehicleType, sort, country,
        ...(searchQ     && { q:            searchQ     }),
        ...(startDate   && { start_date:   startDate   }),
        ...(endDate     && { end_date:     endDate     }),
        ...(instantOnly && { instant_book: "true"      }),
        ...(filters.transmission && { transmission: filters.transmission }),
        ...(filters.min_price    && { min_price:    filters.min_price    }),
        ...(filters.max_price    && { max_price:    filters.max_price    }),
      });
      const r = await fetch(`/api/supaendoro?${params}`);
      const d = await r.json();
      if (d.success) setVehicles(d.data.vehicles ?? []);
    } catch {}
    setBrowsing(false);
  }, [vehicleType, sort, searchQ, country, startDate, endDate, instantOnly, filters]);

  useEffect(() => { fetchHome(); }, [fetchHome]);
  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  const handleSave = async (vehicleId: string) => {
    if (!user) { router.push("/dashboard"); return; }
    const wasSaved = savedIds.has(vehicleId);
    setSavedIds(prev => { const s = new Set(prev); wasSaved ? s.delete(vehicleId) : s.add(vehicleId); return s; });
    try {
      await fetch("/api/supaendoro", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ action: "toggle_save", vehicle_id: vehicleId }),
      });
    } catch {}
  };

  const displayVehicles = vehicles.length > 0 ? vehicles : (homeData?.featured ?? []);

  return (
    <div className={styles.page}>
      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Hero ── */}
      <div className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroContent}>
          <div className={styles.heroPill}>🚗 Pi Peer-to-Peer Rentals</div>
          <h1 className={styles.heroTitle}>
            Rent Any Ride<br />
            <span className={styles.heroTitleSub}>Pay with Pi.</span>
          </h1>
          <p className={styles.heroDesc}>
            Borrow from real Pioneer hosts. Cars, bikes, vans, boats — all in Pi.
          </p>

          {/* Country selector */}
          <div className={styles.countryRow}>
            <CountrySelect value={country} onChange={setCountry} />
          </div>

          {/* Search widget */}
          <div className={styles.searchWidget}>
            <div className={styles.searchRow}>
              <div className={styles.searchField}>
                <span className={styles.searchFieldIcon}>📍</span>
                <input
                  className={styles.searchFieldInput}
                  placeholder="Where are you going?"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.searchDatesRow}>
              <div className={styles.searchDateField}>
                <span className={styles.searchFieldIcon}>📅</span>
                <input
                  type="date"
                  className={styles.searchDateInput}
                  value={startDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={e => setStartDate(e.target.value)}
                  placeholder="Pick-up date"
                />
              </div>
              <div className={styles.searchDateDivider}>→</div>
              <div className={styles.searchDateField}>
                <span className={styles.searchFieldIcon}>📅</span>
                <input
                  type="date"
                  className={styles.searchDateInput}
                  value={endDate}
                  min={startDate || new Date().toISOString().split("T")[0]}
                  onChange={e => setEndDate(e.target.value)}
                  placeholder="Return date"
                />
              </div>
            </div>
            <button className={styles.searchBtn} onClick={fetchVehicles}>
              🔍 Search Available Vehicles
            </button>
          </div>

          {/* Stats */}
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>{homeData?.stats?.vehicles ?? "—"}</span>
              <span className={styles.heroStatLabel}>Vehicles</span>
            </div>
            <div className={styles.heroStatSep} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>{homeData?.stats?.hosts ?? "—"}</span>
              <span className={styles.heroStatLabel}>Hosts</span>
            </div>
            <div className={styles.heroStatSep} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>π</span>
              <span className={styles.heroStatLabel}>Pay with Pi</span>
            </div>
          </div>
        </div>

        {/* Host CTA */}
        <Link href="/endoro/host" className={styles.hostCta}>
          <div className={styles.hostCtaLeft}>
            <div className={styles.hostCtaIcon}>🏠</div>
            <div>
              <div className={styles.hostCtaTitle}>List your vehicle</div>
              <div className={styles.hostCtaSub}>Earn passive Pi income · +150 SC bonus</div>
            </div>
          </div>
          <span className={styles.hostCtaArrow}>→</span>
        </Link>
      </div>

      {/* ── Vehicle Type Pills ── */}
      <div className={styles.typeBar}>
        {VEHICLE_TYPES.map(vt => (
          <button
            key={vt.id}
            className={`${styles.typePill} ${vehicleType === vt.id ? styles.typePillActive : ""}`}
            onClick={() => setVehicleType(vt.id)}
          >
            <span className={styles.typePillEmoji}>{vt.emoji}</span>
            <span className={styles.typePillLabel}>{vt.label}</span>
          </button>
        ))}
      </div>

      {/* ── Controls ── */}
      <div className={styles.controlBar}>
        <div className={styles.controlLeft}>
          <button
            className={`${styles.instantToggle} ${instantOnly ? styles.instantToggleOn : ""}`}
            onClick={() => setInstantOnly(f => !f)}
          >
            ⚡ {instantOnly ? "Instant Book" : "Instant Book"}
          </button>
          <button className={`${styles.filterBtn} ${showFilter ? styles.filterBtnActive : ""}`}
            onClick={() => setShowFilter(f => !f)}>
            ⚙️ Filter
          </button>
        </div>
        <select className={styles.sortSelect} value={sort} onChange={e => setSort(e.target.value)}>
          {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>

      {/* ── Filter Panel ── */}
      {showFilter && (
        <div className={styles.filterPanel}>
          <div className={styles.filterGrid}>
            <div className={styles.filterField}>
              <label className={styles.filterLabel}>Transmission</label>
              <select className={styles.filterSelect} value={filters.transmission}
                onChange={e => setFilters(f => ({ ...f, transmission: e.target.value }))}>
                <option value="">Any</option>
                <option value="automatic">Automatic</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div className={styles.filterField}>
              <label className={styles.filterLabel}>Min Rate (π/day)</label>
              <input className={styles.filterInput} type="number" placeholder="0" value={filters.min_price}
                onChange={e => setFilters(f => ({ ...f, min_price: e.target.value }))} />
            </div>
            <div className={styles.filterField}>
              <label className={styles.filterLabel}>Max Rate (π/day)</label>
              <input className={styles.filterInput} type="number" placeholder="9999" value={filters.max_price}
                onChange={e => setFilters(f => ({ ...f, max_price: e.target.value }))} />
            </div>
          </div>
          <div className={styles.filterActions}>
            <button className={styles.filterApply} onClick={() => { setShowFilter(false); fetchVehicles(); }}>Apply</button>
            <button className={styles.filterClear}  onClick={() => { setFilters({ transmission: "", min_price: "", max_price: "" }); setShowFilter(false); }}>Clear</button>
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div className={styles.body}>

        {/* Section toggle */}
        <div className={styles.sectionToggle}>
          <button
            className={`${styles.sectionToggleBtn} ${activeSection === "browse" ? styles.sectionToggleBtnActive : ""}`}
            onClick={() => setActiveSection("browse")}
          >
            🚘 Browse Vehicles
          </button>
          <button
            className={`${styles.sectionToggleBtn} ${activeSection === "how" ? styles.sectionToggleBtnActive : ""}`}
            onClick={() => setActiveSection("how")}
          >
            ❓ How It Works
          </button>
        </div>

        {/* ── How It Works ── */}
        {activeSection === "how" && (
          <div className={styles.howSection}>
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} className={styles.howCard}>
                <div className={styles.howStep}>{step.step}</div>
                <div className={styles.howIcon}>{step.icon}</div>
                <div className={styles.howTitle}>{step.title}</div>
                <div className={styles.howDesc}>{step.desc}</div>
              </div>
            ))}
            <div className={styles.howRewards}>
              <div className={styles.howRewardsTitle}>💎 SC Rewards for Every Trip</div>
              <div className={styles.howRewardsList}>
                <div className={styles.howRewardItem}><span>🏠 List first vehicle</span><span className={styles.howRewardSc}>+150 SC</span></div>
                <div className={styles.howRewardItem}><span>✅ Complete rental (host)</span><span className={styles.howRewardSc}>+100 SC</span></div>
                <div className={styles.howRewardItem}><span>🚗 Complete rental (renter)</span><span className={styles.howRewardSc}>+50 SC</span></div>
                <div className={styles.howRewardItem}><span>⭐ Leave review</span><span className={styles.howRewardSc}>+30 SC</span></div>
                <div className={styles.howRewardItem}><span>👥 Refer new host</span><span className={styles.howRewardSc}>+200 SC</span></div>
              </div>
            </div>
          </div>
        )}

        {/* ── Vehicle Grid ── */}
        {activeSection === "browse" && (
          browsing ? (
            <div className={styles.grid}>
              {[...Array(6)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}
            </div>
          ) : displayVehicles.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🚗</div>
              <div className={styles.emptyTitle}>No vehicles found</div>
              <div className={styles.emptyDesc}>Try adjusting your dates or filters, or be the first host!</div>
              <Link href="/endoro/host" className={styles.emptyBtn}>Become a Host →</Link>
            </div>
          ) : (
            <>
              <div className={styles.grid}>
                {displayVehicles.map((vehicle: Vehicle) => {
                  const typeInfo = VEHICLE_TYPES.find(vt => vt.id === vehicle.vehicle_type);
                  const tier     = HOST_TIERS[vehicle.host_tier] ?? HOST_TIERS.new;
                  return (
                    <div key={vehicle.id} className={styles.vehicleCard}>
                      <Link href={`/endoro/${vehicle.id}`} className={styles.vehicleImgWrap}>
                        {vehicle.images?.[0]
                          ? <img src={vehicle.images[0]} alt={`${vehicle.make} ${vehicle.model}`} className={styles.vehicleImg} />
                          : <div className={styles.vehicleImgPlaceholder}>{typeInfo?.emoji ?? "🚗"}</div>
                        }
                        {vehicle.instant_book && (
                          <div className={styles.instantBadge}>⚡ Instant</div>
                        )}
                        <button
                          className={`${styles.saveBtn} ${savedIds.has(vehicle.id) ? styles.saveBtnActive : ""}`}
                          onClick={e => { e.preventDefault(); handleSave(vehicle.id); }}
                        >
                          {savedIds.has(vehicle.id) ? "♥" : "♡"}
                        </button>
                      </Link>

                      <Link href={`/endoro/${vehicle.id}`} className={styles.vehicleBody}>
                        <div className={styles.vehicleName}>
                          {vehicle.make} {vehicle.model}
                          {vehicle.year && <span className={styles.vehicleYear}>{vehicle.year}</span>}
                        </div>

                        <div className={styles.vehicleSpecs}>
                          {vehicle.seats > 0 && <span>👥 {vehicle.seats}</span>}
                          <span>⚙️ {vehicle.transmission}</span>
                          <span>⛽ {vehicle.fuel_type}</span>
                        </div>

                        <div className={styles.vehicleLocation}>📍 {vehicle.location || "—"}</div>

                        <div className={styles.vehicleFooter}>
                          <div className={styles.vehiclePrice}>
                            <span className={styles.vehiclePriceNum}>{formatPi(vehicle.daily_rate_pi)}</span>
                            <span className={styles.vehiclePriceUnit}>/day</span>
                          </div>
                          <div className={styles.vehicleRating}>
                            {vehicle.review_count > 0
                              ? <><span className={styles.vehicleRatingStar}>★</span> {vehicle.rating.toFixed(1)} <span className={styles.vehicleReviewCount}>({vehicle.review_count})</span></>
                              : <span className={styles.vehicleNewLabel}>New</span>
                            }
                          </div>
                        </div>

                        {/* Host info */}
                        {vehicle.host && (
                          <div className={styles.vehicleHost}>
                            <div className={styles.vehicleHostAvatar}>
                              {vehicle.host.avatar_url
                                ? <img src={vehicle.host.avatar_url} alt="" className={styles.vehicleHostAvatarImg} />
                                : <span>{getInitial(vehicle.host.username)}</span>
                              }
                            </div>
                            <span className={styles.vehicleHostName}>
                              @{vehicle.host.username}
                              {vehicle.host.kyc_status === "verified" && <KycBadge size={14} />}
                            </span>
                            <span className={styles.vehicleHostTier} style={{ color: tier.color }}>
                              {tier.icon} {tier.label}
                            </span>
                          </div>
                        )}
                      </Link>
                    </div>
                  );
                })}
              </div>

              {/* Top rated section */}
              {(homeData?.topRated ?? []).length > 0 && vehicles.length === 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionTitle}>⭐ Top Rated Vehicles</span>
                  </div>
                  <div className={styles.topRatedScroll}>
                    {(homeData.topRated ?? []).map((vehicle: Vehicle) => {
                      const typeInfo = VEHICLE_TYPES.find(vt => vt.id === vehicle.vehicle_type);
                      return (
                        <Link key={vehicle.id} href={`/endoro/${vehicle.id}`} className={styles.topRatedCard}>
                          <div className={styles.topRatedImg}>
                            {vehicle.images?.[0]
                              ? <img src={vehicle.images[0]} alt="" className={styles.topRatedImgEl} />
                              : <span>{typeInfo?.emoji ?? "🚗"}</span>
                            }
                          </div>
                          <div className={styles.topRatedInfo}>
                            <div className={styles.topRatedName}>{vehicle.make} {vehicle.model}</div>
                            <div className={styles.topRatedPrice}>{formatPi(vehicle.daily_rate_pi)}/day</div>
                            <div className={styles.topRatedRating}>★ {vehicle.rating.toFixed(1)} ({vehicle.review_count})</div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}
