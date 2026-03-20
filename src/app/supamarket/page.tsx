"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import KycBadge from "@/components/ui/KycBadge";
import { CATEGORIES, CONDITIONS, BUYING_METHODS, getSubcategory } from "@/lib/market/categories";
import { ALL_COUNTRIES, getCountry } from "@/lib/market/countries";
import styles from "./page.module.css";

interface Listing {
  id: string; title: string; price_pi: number; images: string[];
  category: string; subcategory?: string; category_deep?: string;
  condition: string; buying_method: string;
  location: string; views: number; likes: number; created_at: string;
  country_code: string; ship_worldwide: boolean; is_boosted?: boolean; boost_tier?: string;
  seller: { id: string; username: string; display_name: string | null; avatar_url: string | null; kyc_status: string };
}

const SORT_OPTIONS = [
  { id: "newest",     label: "Newest" },
  { id: "popular",    label: "Most Popular" },
  { id: "price_asc",  label: "Price: Low to High" },
  { id: "price_desc", label: "Price: High to Low" },
];

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatPiStat(value: number | null): string {
  if (!value || value <= 0) return "0π";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}Kπ`;
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}π`;
}

function CountrySelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = ALL_COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const selected = getCountry(value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className={styles.countrySelect}>
      <button type="button" className={styles.countryBtn} onClick={() => setOpen(p => !p)}>
        {selected.flag} {selected.name} ▾
      </button>
      {open && (
        <div className={styles.countryDropdown}>
          <input
            className={styles.countrySearch}
            placeholder="Search country..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <div className={styles.countryList}>
            {filtered.map(c => (
              <button
                type="button"
                key={c.code}
                className={`${styles.countryOption} ${value === c.code ? styles.countryOptionActive : ""}`}
                onClick={() => { onChange(c.code); setOpen(false); setSearch(""); }}
              >
                {c.flag} {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MarketPageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const sellerFromUrl = searchParams.get("seller") ?? "";
  const [listings, setListings]     = useState<Listing[]>([]);
  const [total, setTotal]           = useState(0);
  const [deliveredCount, setDeliveredCount] = useState<number | null>(null);
  const [totalPiTransactions, setTotalPiTransactions] = useState<number | null>(null);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [country, setCountry]       = useState("MY");

  const [q, setQ]                   = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [category, setCategory]     = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [categoryDeep, setCategoryDeep] = useState("");
  const [condition, setCondition]   = useState("");
  const [method, setMethod]         = useState("");
  const [sort, setSort]             = useState("newest");
  const [showFilters, setShowFilters] = useState(false);

  const selectedCat = CATEGORIES.find(c => c.id === category);
  const selectedSub = category && subcategory ? getSubcategory(category, subcategory) : undefined;

  useEffect(() => {
    fetch("/api/geo").then(r => r.json()).then(d => {
      if (d.success) setCountry(d.data.code);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/supamarket/stats?t=${Date.now()}`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (!d.success || !d.data) return;
        if (typeof d.data.delivered === "number") setDeliveredCount(d.data.delivered);
        if (typeof d.data.total_pi_transactions === "number") {
          setTotalPiTransactions(d.data.total_pi_transactions);
        }
      })
      .catch(() => {});
  }, []);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), sort, country,
        ...(q && { q }),
        ...(category && { category }),
        ...(subcategory && { subcategory }),
        ...(categoryDeep && { category_deep: categoryDeep }),
        ...(condition && { condition }),
        ...(method && { method }),
        ...(sellerFromUrl && { seller: sellerFromUrl }),
      });
      const r = await fetch(`/api/supamarket/listings?${params}`);
      const d = await r.json();
      if (d.success) { setListings(d.data.listings); setTotal(d.data.total); }
    } catch {}
    setLoading(false);
  }, [page, q, category, subcategory, categoryDeep, condition, method, sort, country, sellerFromUrl]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQ(searchInput);
    setPage(1);
  };

  const resetFilters = () => {
    setCategory(""); setSubcategory(""); setCategoryDeep(""); setCondition(""); setMethod("");
    setQ(""); setSearchInput(""); setPage(1);
  };

  const hasFilters = category || condition || method || q || categoryDeep;

  return (
    <div className={styles.page}>
      {/* ── Hero (scrollable, not sticky) ── */}
      <div className={styles.hero}>

        {/* Title + Sell button */}
        <div className={styles.heroTop}>
          <div className={styles.heroInner}>
            <div className={styles.heroBadge}>Pi Network · C2C</div>
            <h1 className={styles.heroTitle}>🛍️ SupaMarket</h1>
            <p className={styles.heroSub}>Buy & sell anything with Pi. Secure escrow, completed transactions.</p>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexShrink: 0, marginTop: 4 }}>
            {user && (
              <Link href="/supamarket/seller" className={styles.hubBtn}>
                📊 Seller
              </Link>
            )}
            <Link href="/supamarket/create" className={styles.sellBtn} style={{ marginLeft: 0 }}>
              + Sell
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <span className={styles.heroStatNum}>{total > 0 ? total.toLocaleString() : "—"}</span>
            <span className={styles.heroStatLabel}>Listings</span>
          </div>
          <div className={styles.heroStatDiv} />
          <div className={styles.heroStat}>
            <span className={styles.heroStatNum}>
              {formatPiStat(totalPiTransactions)}
            </span>
            <span
              className={styles.heroStatLabel}
              title="Calculated from completed orders only."
              aria-label="Calculated from completed orders only."
            >
              Total Pi Transactions
            </span>
          </div>
          <div className={styles.heroStatDiv} />
          <div className={styles.heroStat}>
            <span className={styles.heroStatNum}>{deliveredCount !== null ? deliveredCount.toLocaleString() : "—"}</span>
            <span className={styles.heroStatLabel}>Completed Escrow</span>
          </div>
        </div>

        {/* Country selector */}
        <div className={styles.countryRow}>
          <CountrySelect value={country} onChange={(code) => { setCountry(code); setPage(1); }} />
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className={styles.searchRow}>
          <div className={styles.searchBox}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              className={styles.searchInput}
              placeholder="Search listings..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button type="button" className={styles.searchClear} onClick={() => { setSearchInput(""); setQ(""); }}>✕</button>
            )}
          </div>
          <button type="button" className={`${styles.filterBtn} ${showFilters ? styles.filterBtnActive : ""}`}
            onClick={() => setShowFilters(p => !p)}>
            ⚙️ {hasFilters ? "•" : ""}
          </button>
        </form>

        {/* Worldwide banner */}
        {country === "WORLDWIDE" && (
          <div className={styles.worldwideBanner}>
            🌍 Showing listings with international shipping
          </div>
        )}

        {/* Seller filter banner */}
        {sellerFromUrl && (
          <div className={styles.worldwideBanner}>
            👤 Showing listings from <Link href={`/supaspace/${sellerFromUrl}`} className={styles.sellerFilterLink}>@{sellerFromUrl}</Link>
            {" · "}
            <Link href="/supamarket" className={styles.sellerFilterLink}>Show all</Link>
          </div>
        )}

        {/* Category tabs */}
        <div className={styles.catScroll}>
          <button type="button" className={`${styles.catPill} ${styles.catPillAll} ${!category ? styles.catPillActive : ""}`}
            onClick={() => { setCategory(""); setSubcategory(""); setCategoryDeep(""); setPage(1); }}>
            All
          </button>
          {CATEGORIES.map(c => (
            <button type="button" key={c.id}
              className={`${styles.catPill} ${category === c.id ? styles.catPillActive : ""}`}
              data-category={c.id}
              onClick={() => { setCategory(c.id); setSubcategory(""); setCategoryDeep(""); setPage(1); }}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content (same layout as homepage: section + .container) ── */}
      <section className={styles.contentSection}>
        <div className="container">
      {/* ── Subcategory (white bar, below hero) ── */}
      {selectedCat && (
        <div className={styles.subCatWrap}>
          <button type="button" className={`${styles.subPill} ${!subcategory ? styles.subPillActive : ""}`}
            onClick={() => { setSubcategory(""); setCategoryDeep(""); setPage(1); }}>
            All {selectedCat.label}
          </button>
          {selectedCat.subcategories.map(s => (
            <button type="button" key={s.id}
              className={`${styles.subPill} ${subcategory === s.id ? styles.subPillActive : ""}`}
              onClick={() => { setSubcategory(s.id); setCategoryDeep(""); setPage(1); }}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {selectedCat && subcategory && selectedSub && selectedSub.deep.length > 0 && (
        <div className={styles.deepCatWrap}>
          <button type="button" className={`${styles.deepPill} ${!categoryDeep ? styles.deepPillActive : ""}`}
            onClick={() => { setCategoryDeep(""); setPage(1); }}>
            All types
          </button>
          {selectedSub.deep.map((d) => (
            <button type="button" key={d.id}
              className={`${styles.deepPill} ${categoryDeep === d.id ? styles.deepPillActive : ""}`}
              onClick={() => { setCategoryDeep(d.id); setPage(1); }}>
              {d.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Filter panel ── */}
      {showFilters && (
        <div className={styles.filterPanel}>
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <div className={styles.filterLabel}>Condition</div>
              <div className={styles.filterOptions}>
                <button type="button" className={`${styles.filterOpt} ${!condition ? styles.filterOptActive : ""}`} onClick={() => setCondition("")}>Any</button>
                {CONDITIONS.map(c => (
                  <button type="button" key={c.id} className={`${styles.filterOpt} ${condition === c.id ? styles.filterOptActive : ""}`}
                    onClick={() => { setCondition(c.id); setPage(1); }}>{c.label}</button>
                ))}
              </div>
            </div>
            <div className={styles.filterGroup}>
              <div className={styles.filterLabel}>Method</div>
              <div className={styles.filterOptions}>
                <button type="button" className={`${styles.filterOpt} ${!method ? styles.filterOptActive : ""}`} onClick={() => setMethod("")}>Any</button>
                {BUYING_METHODS.map(m => (
                  <button type="button" key={m.id} className={`${styles.filterOpt} ${method === m.id ? styles.filterOptActive : ""}`}
                    onClick={() => { setMethod(m.id); setPage(1); }}>{m.emoji} {m.label}</button>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>Sort by</div>
            <div className={styles.filterOptions}>
              {SORT_OPTIONS.map(s => (
                <button type="button" key={s.id} className={`${styles.filterOpt} ${sort === s.id ? styles.filterOptActive : ""}`}
                  onClick={() => { setSort(s.id); setPage(1); }}>{s.label}</button>
              ))}
            </div>
          </div>
          {hasFilters && <button type="button" className={styles.resetBtn} onClick={resetFilters}>Reset all filters</button>}
        </div>
      )}

      {/* ── Body ── */}
      <div className={styles.body}>
        <div className={styles.resultsHeader}>
          <span className={styles.resultsCount}>{loading ? "..." : `${total} listings`}</span>
          {hasFilters && <button type="button" className={styles.clearFilters} onClick={resetFilters}>Clear filters ✕</button>}
        </div>

        {loading ? (
          <div className={styles.grid}>
            {[...Array(6)].map((_, i) => <div key={i} className={styles.skeleton} />)}
          </div>
        ) : listings.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🛍️</div>
            <div className={styles.emptyTitle}>No listings found</div>
            <div className={styles.emptyDesc}>
              {country !== "WORLDWIDE" ? "Try switching to 🌍 Worldwide!" : "Be the first to sell!"}
            </div>
            {country !== "WORLDWIDE" && (
              <button type="button" className={styles.worldwideBtn} onClick={() => { setCountry("WORLDWIDE"); setPage(1); }}>
                🌍 Try Worldwide
              </button>
            )}
            <Link href="/supamarket/create" className={styles.emptyBtn}>+ Create Listing</Link>
          </div>
        ) : (
          <>
            <div className={styles.grid}>
              {listings.map((l) => (
                <Link key={l.id} href={`/supamarket/${l.id}`} className={styles.card}>
                  <div className={styles.cardImg}>
                    {l.images?.[0]
                      ? <img src={l.images[0]} alt={l.title} className={styles.cardImgEl} />
                      : <div className={styles.cardImgPlaceholder}>🛍️</div>
                    }
                    {l.is_boosted && (
                      <div className={styles.boostBadge}>
                        {l.boost_tier === "gold" ? "👑" : l.boost_tier === "silver" ? "🥈" : "🥉"} Boosted
                      </div>
                    )}
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardTitle}>{l.title}</div>
                    <div className={styles.cardPrice}>{Number(l.price_pi).toFixed(2)} π</div>
                    <div className={styles.cardMeta}>
                      <span className={styles.cardCondition}>{l.condition?.replace("_", " ")}</span>
                      <div className={styles.cardIcons}>
                        {l.ship_worldwide && <span className={styles.cardIcon} title="Ships worldwide">🌍</span>}
                        {l.country_code && l.country_code !== "WORLDWIDE" && (
                          <span className={styles.cardIcon} title={getCountry(l.country_code).name}>{getCountry(l.country_code).flag}</span>
                        )}
                        <span className={styles.cardIcon} title={l.buying_method === "meetup" ? "Meet up" : l.buying_method === "ship" ? "Shipping" : "Both"}>{l.buying_method === "meetup" ? "📍" : l.buying_method === "ship" ? "📦" : "🤝"}</span>
                      </div>
                      {l.location && <span className={styles.cardLocation}>📍 {l.location}</span>}
                    </div>
                    <div className={styles.cardSeller}>
                      <div className={styles.sellerAvatar}>
                        {l.seller?.avatar_url
                          ? <img src={l.seller.avatar_url} alt="" className={styles.sellerAvatarImg} />
                          : <span>{getInitial(l.seller?.username ?? "?")}</span>
                        }
                      </div>
                      <span className={styles.sellerName}>
                        {l.seller?.display_name ?? l.seller?.username}
                        {l.seller?.kyc_status === "verified" && <KycBadge size={14} />}
                      </span>
                      <span className={styles.cardTime}>{timeAgo(l.created_at)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {total > 20 && (
              <div className={styles.pagination}>
                <button className={styles.pageBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <span className={styles.pageInfo}>Page {page} of {Math.ceil(total / 20)}</span>
                <button className={styles.pageBtn} disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </>
        )}

        {user && listings.length > 0 && (
          <div className={styles.sellCta}>
            <div className={styles.sellCtaText}>Have something to sell?</div>
            <Link href="/supamarket/create" className={styles.sellCtaBtn}>+ Create Listing</Link>
          </div>
        )}
      </div>
        </div>
      </section>

    </div>
  );
}

export default function MarketPage() {
  return (
    <Suspense fallback={
      <div className={styles.page}>
        <div className={styles.grid}>
          {[...Array(6)].map((_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
      </div>
    }>
      <MarketPageContent />
    </Suspense>
  );
}