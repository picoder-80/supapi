"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { CATEGORIES, CONDITIONS, BUYING_METHODS } from "@/lib/market/categories";
import styles from "./page.module.css";

interface Listing {
  id: string; title: string; price_pi: number; images: string[];
  category: string; condition: string; buying_method: string;
  location: string; views: number; likes: number; created_at: string;
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

export default function MarketPage() {
  const { user } = useAuth();
  const [listings, setListings]     = useState<Listing[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);

  // Filters
  const [q, setQ]               = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [condition, setCondition] = useState("");
  const [method, setMethod]     = useState("");
  const [sort, setSort]         = useState("newest");
  const [showFilters, setShowFilters] = useState(false);

  const selectedCat = CATEGORIES.find(c => c.id === category);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), sort,
        ...(q && { q }),
        ...(category && { category }),
        ...(subcategory && { subcategory }),
        ...(condition && { condition }),
        ...(method && { method }),
      });
      const r = await fetch(`/api/market/listings?${params}`);
      const d = await r.json();
      if (d.success) { setListings(d.data.listings); setTotal(d.data.total); }
    } catch {}
    setLoading(false);
  }, [page, q, category, subcategory, condition, method, sort]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQ(searchInput);
    setPage(1);
  };

  const resetFilters = () => {
    setCategory(""); setSubcategory(""); setCondition(""); setMethod("");
    setQ(""); setSearchInput(""); setPage(1);
  };

  const hasFilters = category || condition || method || q;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>🛍️ Marketplace</h1>
          <Link href="/market/create" className={styles.sellBtn}>+ Sell</Link>
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
          <button type="button" className={`${styles.filterBtn} ${showFilters ? styles.filterBtnActive : ""}`} onClick={() => setShowFilters(p => !p)}>
            ⚙️ {hasFilters ? "•" : ""}
          </button>
        </form>

        {/* Category Pills */}
        <div className={styles.catScroll}>
          <button className={`${styles.catPill} ${!category ? styles.catPillActive : ""}`} onClick={() => { setCategory(""); setSubcategory(""); setPage(1); }}>
            All
          </button>
          {CATEGORIES.map(c => (
            <button key={c.id} className={`${styles.catPill} ${category === c.id ? styles.catPillActive : ""}`}
              onClick={() => { setCategory(c.id); setSubcategory(""); setPage(1); }}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        {/* Subcategory pills */}
        {selectedCat && (
          <div className={styles.catScroll}>
            <button className={`${styles.subPill} ${!subcategory ? styles.subPillActive : ""}`} onClick={() => { setSubcategory(""); setPage(1); }}>
              All {selectedCat.label}
            </button>
            {selectedCat.subcategories.map(s => (
              <button key={s.id} className={`${styles.subPill} ${subcategory === s.id ? styles.subPillActive : ""}`}
                onClick={() => { setSubcategory(s.id); setPage(1); }}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className={styles.filterPanel}>
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <div className={styles.filterLabel}>Condition</div>
              <div className={styles.filterOptions}>
                <button className={`${styles.filterOpt} ${!condition ? styles.filterOptActive : ""}`} onClick={() => setCondition("")}>Any</button>
                {CONDITIONS.map(c => (
                  <button key={c.id} className={`${styles.filterOpt} ${condition === c.id ? styles.filterOptActive : ""}`}
                    onClick={() => { setCondition(c.id); setPage(1); }}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.filterGroup}>
              <div className={styles.filterLabel}>Method</div>
              <div className={styles.filterOptions}>
                <button className={`${styles.filterOpt} ${!method ? styles.filterOptActive : ""}`} onClick={() => setMethod("")}>Any</button>
                {BUYING_METHODS.map(m => (
                  <button key={m.id} className={`${styles.filterOpt} ${method === m.id ? styles.filterOptActive : ""}`}
                    onClick={() => { setMethod(m.id); setPage(1); }}>
                    {m.emoji} {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>Sort by</div>
            <div className={styles.filterOptions}>
              {SORT_OPTIONS.map(s => (
                <button key={s.id} className={`${styles.filterOpt} ${sort === s.id ? styles.filterOptActive : ""}`}
                  onClick={() => { setSort(s.id); setPage(1); }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {hasFilters && (
            <button className={styles.resetBtn} onClick={resetFilters}>Reset all filters</button>
          )}
        </div>
      )}

      {/* Results */}
      <div className={styles.body}>
        <div className={styles.resultsHeader}>
          <span className={styles.resultsCount}>{loading ? "..." : `${total} listings`}</span>
          {hasFilters && <button className={styles.clearFilters} onClick={resetFilters}>Clear filters ✕</button>}
        </div>

        {loading ? (
          <div className={styles.grid}>
            {[...Array(6)].map((_, i) => <div key={i} className={styles.skeleton} />)}
          </div>
        ) : listings.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🛍️</div>
            <div className={styles.emptyTitle}>No listings found</div>
            <div className={styles.emptyDesc}>Try different filters or be the first to sell!</div>
            <Link href="/market/create" className={styles.emptyBtn}>+ Create Listing</Link>
          </div>
        ) : (
          <>
            <div className={styles.grid}>
              {listings.map((l) => (
                <Link key={l.id} href={`/market/${l.id}`} className={styles.card}>
                  <div className={styles.cardImg}>
                    {l.images?.[0]
                      ? <img src={l.images[0]} alt={l.title} className={styles.cardImgEl} />
                      : <div className={styles.cardImgPlaceholder}>🛍️</div>
                    }
                    <div className={styles.cardMethod}>
                      {l.buying_method === "meetup" ? "📍" : l.buying_method === "ship" ? "📦" : "🤝"}
                    </div>
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardTitle}>{l.title}</div>
                    <div className={styles.cardPrice}>{Number(l.price_pi).toFixed(2)} π</div>
                    <div className={styles.cardMeta}>
                      <span className={styles.cardCondition}>{l.condition?.replace("_"," ")}</span>
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
                        {l.seller?.kyc_status === "verified" && " ✅"}
                      </span>
                      <span className={styles.cardTime}>{timeAgo(l.created_at)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {total > 20 && (
              <div className={styles.pagination}>
                <button className={styles.pageBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <span className={styles.pageInfo}>Page {page} of {Math.ceil(total / 20)}</span>
                <button className={styles.pageBtn} disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </>
        )}

        {/* Sell CTA for logged in users */}
        {user && listings.length > 0 && (
          <div className={styles.sellCta}>
            <div className={styles.sellCtaText}>Have something to sell?</div>
            <Link href="/market/create" className={styles.sellCtaBtn}>+ Create Listing</Link>
          </div>
        )}
      </div>
    </div>
  );
}
