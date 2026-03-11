"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

// ── Constants ──────────────────────────────────────────────────────────────

const VEHICLE_TYPES = [
  { id: "all",       emoji: "🚘", label: "All Vehicles" },
  { id: "car",       emoji: "🚗", label: "Cars"         },
  { id: "motorcycle",emoji: "🏍️", label: "Motorcycles"  },
  { id: "truck",     emoji: "🚚", label: "Trucks"       },
  { id: "van",       emoji: "🚐", label: "Vans"         },
  { id: "boat",      emoji: "⛵", label: "Boats"        },
  { id: "caravan",   emoji: "🚌", label: "Caravans"     },
  { id: "heavy",     emoji: "🚜", label: "Heavy"        },
];

const LISTING_TABS = [
  { id: "vehicle",  label: "🚗 Vehicles"  },
  { id: "parts",    label: "🔧 Parts"     },
  { id: "auction",  label: "🔨 Auctions"  },
  { id: "wanted",   label: "📋 Wanted"    },
  { id: "workshop", label: "🏪 Workshops" },
];

const FUEL_TYPES     = ["petrol", "diesel", "electric", "hybrid", "gas"];
const TRANSMISSIONS  = ["automatic", "manual", "cvt"];
const SORT_OPTIONS   = [
  { id: "newest",     label: "Newest"        },
  { id: "popular",    label: "Most Viewed"   },
  { id: "price_asc",  label: "Price ↑"       },
  { id: "price_desc", label: "Price ↓"       },
];

const SELLER_RANKS: Record<number, { label: string; icon: string }> = {
  0: { label: "New Seller",     icon: "🔑" },
  3: { label: "Trusted Seller", icon: "⭐" },
  10:{ label: "Premium Dealer", icon: "💎" },
  25:{ label: "Pi Dealer",      icon: "👑" },
};

function getSellerRank(sales: number) {
  if (sales >= 25) return SELLER_RANKS[25];
  if (sales >= 10) return SELLER_RANKS[10];
  if (sales >= 3)  return SELLER_RANKS[3];
  return SELLER_RANKS[0];
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 30)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatPi(n: number) {
  if (n >= 1000000) return `π ${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)    return `π ${(n / 1000).toFixed(1)}K`;
  return `π ${n.toLocaleString()}`;
}

function getInitial(s: string) { return (s ?? "?").charAt(0).toUpperCase(); }

// ── Types ──────────────────────────────────────────────────────────────────

interface Listing {
  id: string;
  seller_id: string;
  listing_type: string;
  vehicle_type: string;
  make: string;
  model: string;
  year: number | null;
  mileage: number | null;
  color: string;
  transmission: string;
  fuel_type: string;
  condition: string;
  price_pi: number;
  negotiable: boolean;
  images: string[];
  location: string;
  view_count: number;
  save_count: number;
  status: string;
  created_at: string;
  auction_end_at?: string | null;
  part_condition?: string;
  seller?: { username: string; display_name: string; avatar_url: string | null; kyc_status: string };
}

interface Workshop {
  id: string; name: string; location: string;
  specializations: string[]; rating: number;
  review_count: number; verified: boolean; logo_url: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function MachinaMarketPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [homeData, setHomeData]     = useState<any>(null);
  const [listings, setListings]     = useState<Listing[]>([]);
  const [loading, setLoading]       = useState(true);
  const [browsing, setBrowsing]     = useState(false);
  const [activeTab, setActiveTab]   = useState("vehicle");
  const [vehicleType, setVehicleType] = useState("all");
  const [sort, setSort]             = useState("newest");
  const [searchQ, setSearchQ]       = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters]       = useState({ transmission: "", fuel_type: "", min_price: "", max_price: "" });
  const [savedIds, setSavedIds]     = useState<Set<string>>(new Set());
  const [toast, setToast]           = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const token = () => typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "";

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch homepage data
  const fetchHome = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/machina-market?mode=home");
      const d = await r.json();
      if (d.success) setHomeData(d.data);
    } catch {}
    setLoading(false);
  }, []);

  // Fetch browse listings
  const fetchListings = useCallback(async () => {
    if (activeTab === "workshop") return;
    setBrowsing(true);
    try {
      const params = new URLSearchParams({
        mode: "browse",
        listing_type: activeTab,
        vehicle_type: vehicleType,
        sort,
        ...(searchQ && { q: searchQ }),
        ...(filters.transmission && { transmission: filters.transmission }),
        ...(filters.fuel_type && { fuel_type: filters.fuel_type }),
        ...(filters.min_price && { min_price: filters.min_price }),
        ...(filters.max_price && { max_price: filters.max_price }),
      });
      const r = await fetch(`/api/machina-market?${params}`);
      const d = await r.json();
      if (d.success) setListings(d.data.listings ?? []);
    } catch {}
    setBrowsing(false);
  }, [activeTab, vehicleType, sort, searchQ, filters]);

  useEffect(() => { fetchHome(); }, [fetchHome]);
  useEffect(() => { fetchListings(); }, [fetchListings]);

  const handleSave = async (listingId: string) => {
    if (!user) { router.push("/dashboard"); return; }
    const wasSaved = savedIds.has(listingId);
    setSavedIds(prev => { const s = new Set(prev); wasSaved ? s.delete(listingId) : s.add(listingId); return s; });
    try {
      const r = await fetch("/api/machina-market", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ action: "toggle_save", listing_id: listingId }),
      });
      const d = await r.json();
      if (!d.success) setSavedIds(prev => { const s = new Set(prev); wasSaved ? s.add(listingId) : s.delete(listingId); return s; });
    } catch { setSavedIds(prev => { const s = new Set(prev); wasSaved ? s.add(listingId) : s.delete(listingId); return s; }); }
  };

  const featuredListings: Listing[] = homeData?.featured ?? [];
  const recentParts: Listing[]      = homeData?.recentParts ?? [];
  const workshops: Workshop[]       = homeData?.workshops ?? [];

  return (
    <div className={styles.page}>

      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Hero ── */}
      <div className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroGlow2} />

        <div className={styles.heroContent}>
          <div className={styles.heroBadgeRow}>
            <span className={styles.heroBadge}>🏎️ Pi Automotive</span>
            <span className={styles.heroLive}>● LIVE</span>
          </div>
          <h1 className={styles.heroTitle}>
            <span className={styles.heroTitleMain}>Machina</span>
            <span className={styles.heroTitleAccent}>Market</span>
          </h1>
          <p className={styles.heroSub}>Buy. Sell. Trade vehicles with Pi.</p>

          {/* Search bar */}
          <div className={styles.searchWrap}>
            <div className={styles.searchBox}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                className={styles.searchInput}
                placeholder="Search make, model, year..."
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onKeyDown={e => e.key === "Enter" && fetchListings()}
              />
              <button className={styles.searchBtn} onClick={fetchListings}>Search</button>
            </div>
          </div>

          {/* Hero Stats */}
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>{homeData?.stats?.total ?? "—"}</span>
              <span className={styles.heroStatLabel}>Listings</span>
            </div>
            <div className={styles.heroStatSep} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>{homeData?.stats?.vehicles ?? "—"}</span>
              <span className={styles.heroStatLabel}>Vehicles</span>
            </div>
            <div className={styles.heroStatSep} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>π</span>
              <span className={styles.heroStatLabel}>Pay with Pi</span>
            </div>
          </div>
        </div>

        {/* Sell CTA */}
        <Link href="/machina-market/create" className={styles.sellCta}>
          <span className={styles.sellCtaIcon}>＋</span>
          <div>
            <div className={styles.sellCtaTitle}>List Your Vehicle</div>
            <div className={styles.sellCtaSub}>First listing earns +150 SC</div>
          </div>
          <span className={styles.sellCtaArrow}>→</span>
        </Link>
      </div>

      {/* ── Vehicle Type Scrollable Pills ── */}
      <div className={styles.vehicleTypeBar}>
        {VEHICLE_TYPES.map(v => (
          <button
            key={v.id}
            className={`${styles.vehicleTypePill} ${vehicleType === v.id ? styles.vehicleTypePillActive : ""}`}
            onClick={() => setVehicleType(v.id)}
          >
            <span className={styles.vehicleTypePillEmoji}>{v.emoji}</span>
            <span className={styles.vehicleTypePillLabel}>{v.label}</span>
          </button>
        ))}
      </div>

      {/* ── Listing Tabs + Filter ── */}
      <div className={styles.tabBar}>
        <div className={styles.tabs}>
          {LISTING_TABS.map(t => (
            <button
              key={t.id}
              className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className={styles.tabActions}>
          <button className={styles.filterBtn} onClick={() => setShowFilter(f => !f)}>
            ⚙️ Filter
          </button>
          <select className={styles.sortSelect} value={sort} onChange={e => setSort(e.target.value)}>
            {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
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
                {TRANSMISSIONS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div className={styles.filterField}>
              <label className={styles.filterLabel}>Fuel Type</label>
              <select className={styles.filterSelect} value={filters.fuel_type}
                onChange={e => setFilters(f => ({ ...f, fuel_type: e.target.value }))}>
                <option value="">Any</option>
                {FUEL_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div className={styles.filterField}>
              <label className={styles.filterLabel}>Min Price (π)</label>
              <input className={styles.filterInput} type="number" placeholder="0" value={filters.min_price}
                onChange={e => setFilters(f => ({ ...f, min_price: e.target.value }))} />
            </div>
            <div className={styles.filterField}>
              <label className={styles.filterLabel}>Max Price (π)</label>
              <input className={styles.filterInput} type="number" placeholder="999999" value={filters.max_price}
                onChange={e => setFilters(f => ({ ...f, max_price: e.target.value }))} />
            </div>
          </div>
          <div className={styles.filterActions}>
            <button className={styles.filterApplyBtn} onClick={() => { setShowFilter(false); fetchListings(); }}>Apply Filters</button>
            <button className={styles.filterClearBtn} onClick={() => { setFilters({ transmission: "", fuel_type: "", min_price: "", max_price: "" }); setShowFilter(false); }}>Clear</button>
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div className={styles.body}>

        {/* Vehicle / Parts / Auction / Wanted grid */}
        {activeTab !== "workshop" && (
          browsing ? (
            <div className={styles.grid}>
              {[...Array(6)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}
            </div>
          ) : listings.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🚗</div>
              <div className={styles.emptyTitle}>No listings found</div>
              <div className={styles.emptyDesc}>Be the first to list in this category!</div>
              <Link href="/machina-market/create" className={styles.emptyBtn}>+ Create Listing</Link>
            </div>
          ) : (
            <div className={styles.grid}>
              {listings.map((listing) => (
                <div key={listing.id} className={styles.listingCard}>
                  <Link href={`/machina-market/${listing.id}`} className={styles.listingImgWrap}>
                    {listing.images?.[0]
                      ? <img src={listing.images[0]} alt={`${listing.make} ${listing.model}`} className={styles.listingImg} />
                      : <div className={styles.listingImgPlaceholder}>
                          {VEHICLE_TYPES.find(v => v.id === listing.vehicle_type)?.emoji ?? "🚗"}
                        </div>
                    }
                    {listing.listing_type === "auction" && listing.auction_end_at && (
                      <div className={styles.auctionBadge}>🔨 Auction</div>
                    )}
                    {listing.condition === "new" && <div className={styles.newBadge}>NEW</div>}
                    <button
                      className={`${styles.saveBtn} ${savedIds.has(listing.id) ? styles.saveBtnActive : ""}`}
                      onClick={e => { e.preventDefault(); handleSave(listing.id); }}
                    >
                      {savedIds.has(listing.id) ? "♥" : "♡"}
                    </button>
                  </Link>
                  <Link href={`/machina-market/${listing.id}`} className={styles.listingBody}>
                    <div className={styles.listingMakeModel}>
                      <span className={styles.listingMake}>{listing.make}</span>
                      <span className={styles.listingModel}>{listing.model}</span>
                      {listing.year && <span className={styles.listingYear}>{listing.year}</span>}
                    </div>
                    <div className={styles.listingPrice}>
                      {formatPi(listing.price_pi)}
                      {listing.negotiable && <span className={styles.listingNego}>Nego</span>}
                    </div>
                    <div className={styles.listingSpecs}>
                      {listing.mileage != null && <span>🔢 {listing.mileage.toLocaleString()} km</span>}
                      {listing.transmission && <span>⚙️ {listing.transmission}</span>}
                      {listing.fuel_type && <span>⛽ {listing.fuel_type}</span>}
                    </div>
                    <div className={styles.listingFooter}>
                      <span className={styles.listingLocation}>📍 {listing.location || "—"}</span>
                      <span className={styles.listingTime}>{timeAgo(listing.created_at)}</span>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )
        )}

        {/* Workshop tab */}
        {activeTab === "workshop" && (
          <div className={styles.workshopList}>
            {loading ? (
              [...Array(4)].map((_, i) => <div key={i} className={styles.skeletonWorkshop} />)
            ) : workshops.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🏪</div>
                <div className={styles.emptyTitle}>No workshops yet</div>
                <div className={styles.emptyDesc}>Register your workshop and accept Pi payments!</div>
                <button className={styles.emptyBtn} onClick={() => user ? showToast("Workshop registration coming soon!") : router.push("/dashboard")}>
                  Register Workshop
                </button>
              </div>
            ) : workshops.map((ws) => (
              <div key={ws.id} className={styles.workshopCard}>
                <div className={styles.workshopLeft}>
                  <div className={styles.workshopLogo}>
                    {ws.logo_url
                      ? <img src={ws.logo_url} alt={ws.name} className={styles.workshopLogoImg} />
                      : <span className={styles.workshopLogoInitial}>{getInitial(ws.name)}</span>
                    }
                  </div>
                </div>
                <div className={styles.workshopInfo}>
                  <div className={styles.workshopName}>
                    {ws.name}
                    {ws.verified && <span className={styles.workshopVerified}>✅ Verified</span>}
                  </div>
                  <div className={styles.workshopLocation}>📍 {ws.location}</div>
                  <div className={styles.workshopSpecs}>
                    {ws.specializations?.slice(0, 3).map((s: string) => (
                      <span key={s} className={styles.workshopSpec}>{s}</span>
                    ))}
                  </div>
                </div>
                <div className={styles.workshopRight}>
                  <div className={styles.workshopRating}>
                    ⭐ {ws.rating > 0 ? ws.rating.toFixed(1) : "—"}
                  </div>
                  <div className={styles.workshopReviews}>{ws.review_count} reviews</div>
                  <div className={styles.workshopPi}>Accepts π</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Featured (homepage snapshot) ── */}
        {activeTab === "vehicle" && listings.length === 0 && !browsing && featuredListings.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>🔥 Featured Vehicles</span>
            </div>
            <div className={styles.grid}>
              {featuredListings.map((listing) => (
                <div key={listing.id} className={styles.listingCard}>
                  <Link href={`/machina-market/${listing.id}`} className={styles.listingImgWrap}>
                    {listing.images?.[0]
                      ? <img src={listing.images[0]} alt={`${listing.make} ${listing.model}`} className={styles.listingImg} />
                      : <div className={styles.listingImgPlaceholder}>
                          {VEHICLE_TYPES.find(v => v.id === listing.vehicle_type)?.emoji ?? "🚗"}
                        </div>
                    }
                    <button
                      className={`${styles.saveBtn} ${savedIds.has(listing.id) ? styles.saveBtnActive : ""}`}
                      onClick={e => { e.preventDefault(); handleSave(listing.id); }}
                    >
                      {savedIds.has(listing.id) ? "♥" : "♡"}
                    </button>
                  </Link>
                  <Link href={`/machina-market/${listing.id}`} className={styles.listingBody}>
                    <div className={styles.listingMakeModel}>
                      <span className={styles.listingMake}>{listing.make}</span>
                      <span className={styles.listingModel}>{listing.model}</span>
                      {listing.year && <span className={styles.listingYear}>{listing.year}</span>}
                    </div>
                    <div className={styles.listingPrice}>{formatPi(listing.price_pi)}</div>
                    <div className={styles.listingSpecs}>
                      {listing.mileage != null && <span>🔢 {listing.mileage.toLocaleString()} km</span>}
                      {listing.transmission && <span>⚙️ {listing.transmission}</span>}
                    </div>
                    <div className={styles.listingFooter}>
                      <span className={styles.listingLocation}>📍 {listing.location || "—"}</span>
                      <span className={styles.listingTime}>{timeAgo(listing.created_at)}</span>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Parts preview */}
        {activeTab === "vehicle" && recentParts.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>🔧 Recent Parts & Accessories</span>
              <button className={styles.sectionMore} onClick={() => setActiveTab("parts")}>See All →</button>
            </div>
            <div className={styles.partsGrid}>
              {recentParts.slice(0, 4).map((part) => (
                <Link key={part.id} href={`/machina-market/${part.id}`} className={styles.partCard}>
                  <div className={styles.partImg}>
                    {part.images?.[0]
                      ? <img src={part.images[0]} alt={part.make} className={styles.partImgEl} />
                      : <span className={styles.partImgPlaceholder}>🔧</span>
                    }
                  </div>
                  <div className={styles.partInfo}>
                    <div className={styles.partTitle}>{part.make} {part.model}</div>
                    <div className={styles.partPrice}>{formatPi(part.price_pi)}</div>
                    <div className={styles.partCond}>{part.part_condition}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
