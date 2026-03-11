"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

// ── Constants ──────────────────────────────────────────────────────────────

const PROPERTY_TYPES = [
  { id: "all",       emoji: "🏘️",  label: "All"            },
  { id: "apartment", emoji: "🏢",  label: "Apartment"      },
  { id: "condo",     emoji: "🏙️",  label: "Condominium"    },
  { id: "terrace",   emoji: "🏠",  label: "Terrace"        },
  { id: "semi-d",    emoji: "🏡",  label: "Semi-D"         },
  { id: "bungalow",  emoji: "🏰",  label: "Bungalow"       },
  { id: "studio",    emoji: "🛋️",  label: "Studio"         },
  { id: "room",      emoji: "🛏️",  label: "Room"           },
  { id: "office",    emoji: "🏢",  label: "Office"         },
  { id: "shop",      emoji: "🏪",  label: "Shophouse"      },
  { id: "land",      emoji: "🌿",  label: "Land"           },
  { id: "soho",      emoji: "💼",  label: "SOHO / SOVO"    },
];

const LISTING_MODES = [
  { id: "sale",    label: "For Sale"    },
  { id: "rent",    label: "For Rent"    },
  { id: "auction", label: "Auction"     },
  { id: "project", label: "New Projects"},
];

const SORT_OPTIONS = [
  { id: "newest",     label: "Newest"      },
  { id: "popular",    label: "Most Viewed" },
  { id: "price_asc",  label: "Price ↑"     },
  { id: "price_desc", label: "Price ↓"     },
];

const FURNISHING_OPTIONS = ["fully", "partial", "unfurnished"];
const TENURE_OPTIONS     = ["freehold", "leasehold"];

const AGENT_TIERS: Record<string, { label: string; color: string }> = {
  rookie:  { label: "🥉 Rookie Agent",   color: "#CD7F32" },
  active:  { label: "🥈 Active Agent",   color: "#718096" },
  top:     { label: "🥇 Top Agent",      color: "#F5A623" },
  elite:   { label: "👑 Elite Agent",    color: "#805AD5" },
};

function formatPi(n: number) {
  if (!n) return "—";
  if (n >= 1000000) return `π ${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000)    return `π ${(n / 1000).toFixed(0)}K`;
  return `π ${n.toLocaleString()}`;
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 30)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function getInitial(s: string) { return (s ?? "?").charAt(0).toUpperCase(); }

// ── Types ──────────────────────────────────────────────────────────────────
interface Listing {
  id: string; seller_id: string; agent_id: string | null;
  listing_mode: string; property_type: string; title: string;
  images: string[]; price_pi: number | null; rental_pi_month: number | null;
  negotiable: boolean; bedrooms: number; bathrooms: number;
  built_up_sqft: number | null; furnishing: string; tenure: string;
  location: string; view_count: number; save_count: number;
  created_at: string; psf: string | null;
  seller?: { username: string; display_name: string; avatar_url: string | null; kyc_status: string };
  agent?: { agency_name: string; tier: string; verified: boolean; rating: number };
}

interface Project {
  id: string; project_name: string; developer_name: string; images: string[];
  location: string; property_type: string; min_price_pi: number; max_price_pi: number;
  total_units: number; available_units: number; expected_completion: string; tenure: string;
}

interface Agent {
  id: string; user_id: string; agency_name: string; tier: string; verified: boolean;
  rating: number; review_count: number; photo_url: string; specializations: string[];
  total_listings: number; deals_closed: number;
  user?: { username: string; avatar_url: string | null; kyc_status: string };
}

// ── Calculator Modal ───────────────────────────────────────────────────────
function AffordabilityCalc({ onClose }: { onClose: () => void }) {
  const [budget, setBudget]   = useState("");
  const [monthly, setMonthly] = useState("");
  const [rate, setRate]       = useState("7");
  const [years, setYears]     = useState("30");

  const monthlyPayment = () => {
    const p = parseFloat(budget) || 0;
    const r = (parseFloat(rate) / 100) / 12;
    const n = parseFloat(years) * 12;
    if (!p || !r || !n) return 0;
    return (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  };

  const rentalYield = () => {
    const price = parseFloat(budget) || 0;
    const rent  = parseFloat(monthly) || 0;
    if (!price || !rent) return 0;
    return ((rent * 12) / price * 100).toFixed(2);
  };

  return (
    <div className={styles.modal}>
      <div className={styles.modalBackdrop} onClick={onClose} />
      <div className={styles.modalSheet}>
        <div className={styles.modalHandle} />
        <div className={styles.modalTitle}>🧮 Property Calculator</div>

        <div className={styles.calcGrid}>
          <div className={styles.calcSection}>
            <div className={styles.calcSectionTitle}>Mortgage Estimator</div>
            <label className={styles.calcLabel}>Property Price (π)</label>
            <input className={styles.calcInput} type="number" placeholder="e.g. 50000" value={budget} onChange={e => setBudget(e.target.value)} />
            <label className={styles.calcLabel}>Annual Interest Rate (%)</label>
            <input className={styles.calcInput} type="number" placeholder="7" value={rate} onChange={e => setRate(e.target.value)} />
            <label className={styles.calcLabel}>Loan Period (years)</label>
            <input className={styles.calcInput} type="number" placeholder="30" value={years} onChange={e => setYears(e.target.value)} />
            <div className={styles.calcResult}>
              <span className={styles.calcResultLabel}>Est. Monthly Payment</span>
              <span className={styles.calcResultValue}>{formatPi(monthlyPayment())} / mo</span>
            </div>
          </div>

          <div className={styles.calcSection}>
            <div className={styles.calcSectionTitle}>Rental Yield</div>
            <label className={styles.calcLabel}>Property Value (π)</label>
            <input className={styles.calcInput} type="number" placeholder="e.g. 50000" value={budget} onChange={e => setBudget(e.target.value)} />
            <label className={styles.calcLabel}>Monthly Rental (π)</label>
            <input className={styles.calcInput} type="number" placeholder="e.g. 300" value={monthly} onChange={e => setMonthly(e.target.value)} />
            <div className={styles.calcResult}>
              <span className={styles.calcResultLabel}>Annual Rental Yield</span>
              <span className={styles.calcResultValue}>{rentalYield()}%</span>
            </div>
          </div>
        </div>

        <button className={styles.calcCloseBtn} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function DomusPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [homeData, setHomeData]       = useState<any>(null);
  const [listings, setListings]       = useState<Listing[]>([]);
  const [loading, setLoading]         = useState(true);
  const [browsing, setBrowsing]       = useState(false);
  const [activeMode, setActiveMode]   = useState("sale");
  const [propType, setPropType]       = useState("all");
  const [sort, setSort]               = useState("newest");
  const [searchQ, setSearchQ]         = useState("");
  const [showFilter, setShowFilter]   = useState(false);
  const [showCalc, setShowCalc]       = useState(false);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [filters, setFilters]         = useState({ bedrooms: "", furnishing: "", tenure: "", min_price: "", max_price: "" });
  const [savedIds, setSavedIds]       = useState<Set<string>>(new Set());
  const [agentForm, setAgentForm]     = useState({ license_no: "", agency_name: "", bio: "", whatsapp: "" });
  const [agentLoading, setAgentLoading] = useState(false);
  const [toast, setToast]             = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const token = () => typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "";

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchHome = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/domus?mode=home");
      const d = await r.json();
      if (d.success) setHomeData(d.data);
    } catch {}
    setLoading(false);
  }, []);

  const fetchListings = useCallback(async () => {
    if (activeMode === "project") return;
    setBrowsing(true);
    try {
      const params = new URLSearchParams({
        mode: "browse", listing_mode: activeMode, property_type: propType, sort,
        ...(searchQ && { q: searchQ }),
        ...(filters.bedrooms   && { bedrooms:   filters.bedrooms   }),
        ...(filters.furnishing && { furnishing: filters.furnishing }),
        ...(filters.tenure     && { tenure:     filters.tenure     }),
        ...(filters.min_price  && { min_price:  filters.min_price  }),
        ...(filters.max_price  && { max_price:  filters.max_price  }),
      });
      const r = await fetch(`/api/domus?${params}`);
      const d = await r.json();
      if (d.success) setListings(d.data.listings ?? []);
    } catch {}
    setBrowsing(false);
  }, [activeMode, propType, sort, searchQ, filters]);

  useEffect(() => { fetchHome(); }, [fetchHome]);
  useEffect(() => { fetchListings(); }, [fetchListings]);

  const handleSave = async (listingId: string) => {
    if (!user) { router.push("/dashboard"); return; }
    const wasSaved = savedIds.has(listingId);
    setSavedIds(prev => { const s = new Set(prev); wasSaved ? s.delete(listingId) : s.add(listingId); return s; });
    try {
      await fetch("/api/domus", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ action: "toggle_save", listing_id: listingId }),
      });
    } catch {}
  };

  const handleRegisterAgent = async () => {
    if (!user) { router.push("/dashboard"); return; }
    setAgentLoading(true);
    try {
      const r = await fetch("/api/domus", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ action: "register_agent", ...agentForm }),
      });
      const d = await r.json();
      if (d.success) {
        setShowAgentModal(false);
        showToast("🎉 Pioneer Agent registered! +200 SC earned!");
      } else {
        showToast(d.error ?? "Registration failed", "error");
      }
    } catch { showToast("Something went wrong", "error"); }
    setAgentLoading(false);
  };

  const displayListings = listings.length > 0 ? listings
    : activeMode === "sale" ? (homeData?.forSale ?? [])
    : (homeData?.forRent ?? []);

  const projects: Project[] = homeData?.projects ?? [];
  const topAgents: Agent[]  = homeData?.topAgents ?? [];

  return (
    <div className={styles.page}>
      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Hero ── */}
      <div className={styles.hero}>
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>🏠 Pi Property Marketplace</div>
          <h1 className={styles.heroTitle}>Find Your<br /><em className={styles.heroTitleEm}>Dream Home</em></h1>
          <p className={styles.heroSub}>Buy, sell and rent properties with Pi.</p>

          {/* Search */}
          <div className={styles.searchCard}>
            <div className={styles.searchModeTabs}>
              {LISTING_MODES.map(m => (
                <button
                  key={m.id}
                  className={`${styles.searchModeTab} ${activeMode === m.id ? styles.searchModeTabActive : ""}`}
                  onClick={() => setActiveMode(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className={styles.searchInputRow}>
              <input
                className={styles.searchInput}
                placeholder="Search by location, title, or keyword..."
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onKeyDown={e => e.key === "Enter" && fetchListings()}
              />
              <button className={styles.searchBtn} onClick={fetchListings}>🔍 Search</button>
            </div>
          </div>

          {/* Stats row */}
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>{homeData?.stats?.sale ?? "—"}</span>
              <span className={styles.heroStatLabel}>For Sale</span>
            </div>
            <div className={styles.heroStatSep} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>{homeData?.stats?.rent ?? "—"}</span>
              <span className={styles.heroStatLabel}>For Rent</span>
            </div>
            <div className={styles.heroStatSep} />
            <button className={styles.calcHeroBtn} onClick={() => setShowCalc(true)}>
              🧮 Calculator
            </button>
          </div>
        </div>

        {/* Agent CTA */}
        <div className={styles.agentCta}>
          <div className={styles.agentCtaLeft}>
            <div className={styles.agentCtaTitle}>Are you a property agent?</div>
            <div className={styles.agentCtaSub}>Register as Pioneer Agent and earn +200 SC</div>
          </div>
          <button className={styles.agentCtaBtn} onClick={() => user ? setShowAgentModal(true) : router.push("/dashboard")}>
            Join →
          </button>
        </div>
      </div>

      {/* ── Property Type Scroll ── */}
      <div className={styles.typeBar}>
        {PROPERTY_TYPES.map(pt => (
          <button
            key={pt.id}
            className={`${styles.typePill} ${propType === pt.id ? styles.typePillActive : ""}`}
            onClick={() => setPropType(pt.id)}
          >
            <span className={styles.typePillEmoji}>{pt.emoji}</span>
            <span className={styles.typePillLabel}>{pt.label}</span>
          </button>
        ))}
      </div>

      {/* ── Filter / Sort Row ── */}
      <div className={styles.controlBar}>
        <div className={styles.controlLeft}>
          <button className={`${styles.filterBtn} ${showFilter ? styles.filterBtnActive : ""}`} onClick={() => setShowFilter(f => !f)}>
            ⚙️ Filters
          </button>
          <Link href="/domus/create" className={styles.listBtn}>+ List Property</Link>
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
              <label className={styles.filterLabel}>Min Bedrooms</label>
              <select className={styles.filterSelect} value={filters.bedrooms} onChange={e => setFilters(f => ({ ...f, bedrooms: e.target.value }))}>
                <option value="">Any</option>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}+</option>)}
              </select>
            </div>
            <div className={styles.filterField}>
              <label className={styles.filterLabel}>Furnishing</label>
              <select className={styles.filterSelect} value={filters.furnishing} onChange={e => setFilters(f => ({ ...f, furnishing: e.target.value }))}>
                <option value="">Any</option>
                {FURNISHING_OPTIONS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
              </select>
            </div>
            <div className={styles.filterField}>
              <label className={styles.filterLabel}>Tenure</label>
              <select className={styles.filterSelect} value={filters.tenure} onChange={e => setFilters(f => ({ ...f, tenure: e.target.value }))}>
                <option value="">Any</option>
                {TENURE_OPTIONS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
              </select>
            </div>
            <div className={styles.filterField}>
              <label className={styles.filterLabel}>Min Price (π)</label>
              <input className={styles.filterInput} type="number" placeholder="0" value={filters.min_price} onChange={e => setFilters(f => ({ ...f, min_price: e.target.value }))} />
            </div>
            <div className={styles.filterField}>
              <label className={styles.filterLabel}>Max Price (π)</label>
              <input className={styles.filterInput} type="number" placeholder="999999" value={filters.max_price} onChange={e => setFilters(f => ({ ...f, max_price: e.target.value }))} />
            </div>
          </div>
          <div className={styles.filterActions}>
            <button className={styles.filterApply} onClick={() => { setShowFilter(false); fetchListings(); }}>Apply</button>
            <button className={styles.filterClear}  onClick={() => { setFilters({ bedrooms: "", furnishing: "", tenure: "", min_price: "", max_price: "" }); setShowFilter(false); }}>Clear</button>
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div className={styles.body}>

        {/* ── New Projects Tab ── */}
        {activeMode === "project" ? (
          <div className={styles.projectsList}>
            {projects.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🏗️</div>
                <div className={styles.emptyTitle}>No new projects yet</div>
                <div className={styles.emptyDesc}>Be the first developer to launch on Domus!</div>
              </div>
            ) : projects.map(proj => (
              <div key={proj.id} className={styles.projectCard}>
                <div className={styles.projectImgWrap}>
                  {proj.images?.[0]
                    ? <img src={proj.images[0]} alt={proj.project_name} className={styles.projectImg} />
                    : <div className={styles.projectImgPlaceholder}>🏗️</div>
                  }
                  <div className={styles.projectBadge}>{proj.tenure}</div>
                </div>
                <div className={styles.projectBody}>
                  <div className={styles.projectDev}>{proj.developer_name}</div>
                  <div className={styles.projectName}>{proj.project_name}</div>
                  <div className={styles.projectLocation}>📍 {proj.location}</div>
                  <div className={styles.projectPrice}>
                    {formatPi(proj.min_price_pi)} – {formatPi(proj.max_price_pi)}
                  </div>
                  <div className={styles.projectMeta}>
                    <span>🏢 {proj.total_units} units</span>
                    <span>✅ {proj.available_units} available</span>
                    <span>📅 {proj.expected_completion}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (

          /* ── Listings Grid ── */
          browsing ? (
            <div className={styles.grid}>
              {[...Array(6)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}
            </div>
          ) : displayListings.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🏠</div>
              <div className={styles.emptyTitle}>No properties found</div>
              <div className={styles.emptyDesc}>Be the first to list in this category!</div>
              <Link href="/domus/create" className={styles.emptyBtn}>+ List Property</Link>
            </div>
          ) : (
            <div className={styles.grid}>
              {displayListings.map((listing: Listing) => {
                const price = listing.listing_mode === "rent" ? listing.rental_pi_month : listing.price_pi;
                const propTypeInfo = PROPERTY_TYPES.find(pt => pt.id === listing.property_type);
                return (
                  <div key={listing.id} className={styles.listingCard}>
                    <Link href={`/domus/${listing.id}`} className={styles.listingImgWrap}>
                      {listing.images?.[0]
                        ? <img src={listing.images[0]} alt={listing.title} className={styles.listingImg} />
                        : <div className={styles.listingImgPlaceholder}>{propTypeInfo?.emoji ?? "🏠"}</div>
                      }
                      <div className={styles.listingModeBadge}>
                        {listing.listing_mode === "rent" ? "For Rent" : listing.listing_mode === "auction" ? "🔨 Auction" : "For Sale"}
                      </div>
                      <button
                        className={`${styles.saveBtn} ${savedIds.has(listing.id) ? styles.saveBtnActive : ""}`}
                        onClick={e => { e.preventDefault(); handleSave(listing.id); }}
                      >
                        {savedIds.has(listing.id) ? "♥" : "♡"}
                      </button>
                    </Link>
                    <Link href={`/domus/${listing.id}`} className={styles.listingBody}>
                      <div className={styles.listingPrice}>
                        {formatPi(price ?? 0)}
                        {listing.listing_mode === "rent" && <span className={styles.listingPriceUnit}>/mo</span>}
                        {listing.negotiable && <span className={styles.negoBadge}>Nego</span>}
                      </div>
                      <div className={styles.listingTitle}>{listing.title}</div>
                      <div className={styles.listingSpecs}>
                        {listing.bedrooms > 0 && <span>🛏 {listing.bedrooms}</span>}
                        {listing.bathrooms > 0 && <span>🚿 {listing.bathrooms}</span>}
                        {listing.built_up_sqft && <span>📐 {listing.built_up_sqft.toLocaleString()} sqft</span>}
                      </div>
                      {listing.psf && (
                        <div className={styles.listingPsf}>π {listing.psf} psf</div>
                      )}
                      <div className={styles.listingFooter}>
                        <span className={styles.listingLocation}>📍 {listing.location || "—"}</span>
                        <span className={styles.listingAge}>{timeAgo(listing.created_at)}</span>
                      </div>
                      {listing.agent && (
                        <div className={styles.listingAgent}>
                          <span className={styles.listingAgentTier}>{AGENT_TIERS[listing.agent.tier]?.label}</span>
                          <span className={styles.listingAgentName}>{listing.agent.agency_name}</span>
                        </div>
                      )}
                    </Link>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── Top Agents ── */}
        {topAgents.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>🏆 Top Pioneer Agents</span>
              <Link href="/domus/agents" className={styles.sectionMore}>See All →</Link>
            </div>
            <div className={styles.agentsRow}>
              {topAgents.map((agent: Agent) => (
                <Link key={agent.id} href={`/domus/agent/${agent.id}`} className={styles.agentCard}>
                  <div className={styles.agentAvatar}>
                    {agent.photo_url || agent.user?.avatar_url
                      ? <img src={agent.photo_url || agent.user?.avatar_url!} alt={agent.agency_name} className={styles.agentAvatarImg} />
                      : <span className={styles.agentAvatarInitial}>{getInitial(agent.agency_name || agent.user?.username || "A")}</span>
                    }
                    {agent.verified && <span className={styles.agentVerifiedDot}>✅</span>}
                  </div>
                  <div className={styles.agentName}>{agent.user?.username ?? "Agent"}</div>
                  <div className={styles.agentAgency}>{agent.agency_name}</div>
                  <div className={styles.agentTierLabel}
                    style={{ color: AGENT_TIERS[agent.tier]?.color }}>
                    {AGENT_TIERS[agent.tier]?.label}
                  </div>
                  <div className={styles.agentStats}>
                    <span>⭐ {agent.rating > 0 ? agent.rating.toFixed(1) : "—"}</span>
                    <span>📦 {agent.total_listings}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Calculator Modal ── */}
      {showCalc && <AffordabilityCalc onClose={() => setShowCalc(false)} />}

      {/* ── Agent Registration Modal ── */}
      {showAgentModal && (
        <div className={styles.modal}>
          <div className={styles.modalBackdrop} onClick={() => !agentLoading && setShowAgentModal(false)} />
          <div className={styles.modalSheet}>
            <div className={styles.modalHandle} />
            <div className={styles.modalTitle}>🏠 Register as Pioneer Agent</div>
            <div className={styles.modalSub}>List properties professionally and earn +200 SC bonus!</div>

            <label className={styles.calcLabel}>License Number</label>
            <input className={styles.calcInput} placeholder="Your real estate license no." value={agentForm.license_no}
              onChange={e => setAgentForm(f => ({ ...f, license_no: e.target.value }))} />

            <label className={styles.calcLabel}>Agency / Company Name</label>
            <input className={styles.calcInput} placeholder="e.g. Pioneer Realty Group" value={agentForm.agency_name}
              onChange={e => setAgentForm(f => ({ ...f, agency_name: e.target.value }))} />

            <label className={styles.calcLabel}>Bio</label>
            <textarea className={styles.calcTextarea} rows={3}
              placeholder="Tell buyers about your experience..."
              value={agentForm.bio}
              onChange={e => setAgentForm(f => ({ ...f, bio: e.target.value }))} />

            <label className={styles.calcLabel}>WhatsApp Number</label>
            <input className={styles.calcInput} placeholder="+1234567890" value={agentForm.whatsapp}
              onChange={e => setAgentForm(f => ({ ...f, whatsapp: e.target.value }))} />

            <button className={styles.modalSubmitBtn} onClick={handleRegisterAgent} disabled={agentLoading}>
              {agentLoading ? "Registering..." : "🚀 Register & Earn 200 SC"}
            </button>
            <button className={styles.modalCancelBtn} onClick={() => setShowAgentModal(false)} disabled={agentLoading}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
