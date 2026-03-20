"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import KycBadge from "@/components/ui/KycBadge";
import { CATEGORIES as SUPASIFIEDS_CATEGORIES, getSubcategory as getSupasifiedsSubcategory } from "@/lib/supasifieds/categories";
import { CATEGORIES as SUPAAUTO_CATEGORIES, getSubcategory as getSupaautoSubcategory } from "@/lib/supaauto/categories";
import { CATEGORIES as SUPADOMUS_CATEGORIES, getSubcategory as getSupadomusSubcategory } from "@/lib/supadomus/categories";
import { formatPiPriceDisplay } from "@/lib/supasifieds/price";
import { ALL_COUNTRIES, getCountry } from "@/lib/market/countries";
import styles from "../supamarket/page.module.css";

interface ClassifiedRow {
  id: string;
  title: string;
  price_display: string | null;
  images: string[];
  category: string;
  subcategory?: string;
  category_deep?: string;
  location: string;
  views: number;
  created_at: string;
  country_code: string | null;
  is_boosted?: boolean;
  boost_tier?: string;
  spotlight_expires_at?: string | null;
  seller: { id: string; username: string; display_name: string | null; avatar_url: string | null; kyc_status: string };
}

interface CarouselAd {
  id: string;
  image_url: string;
  headline: string;
  cta_label: string;
  link_url: string;
}

const SORT_OPTIONS = [
  { id: "newest", label: "Newest" },
  { id: "popular", label: "Most Viewed" },
];

function getInitial(u: string) {
  return u?.charAt(0).toUpperCase() ?? "?";
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function CountrySelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = ALL_COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase())
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
      <button type="button" className={styles.countryBtn} onClick={() => setOpen((p) => !p)}>
        <span>{selected.flag}</span>
        <span className={styles.countryBtnName}>{selected.name}</span>
        <span className={styles.countryBtnCode}>{selected.code}</span>
        <span className={styles.countryBtnArrow}>▾</span>
      </button>
      {open && (
        <div className={styles.countryDropdown}>
          <input
            className={styles.countrySearch}
            placeholder="Search country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className={styles.countryList}>
            {filtered.map((c) => (
              <button
                type="button"
                key={c.code}
                className={`${styles.countryOption} ${value === c.code ? styles.countryOptionActive : ""}`}
                onClick={() => {
                  onChange(c.code);
                  setOpen(false);
                  setSearch("");
                }}
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

function SupasifiedsContent() {
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isSupaauto = pathname?.startsWith("/supaauto");
  const isSupadomus = pathname?.startsWith("/supadomus");
  const appBase = isSupaauto ? "/supaauto" : isSupadomus ? "/supadomus" : "/supasifieds";
  const apiBase = isSupaauto ? "/api/supaauto" : isSupadomus ? "/api/supadomus" : "/api/supasifieds";
  const CATEGORIES = isSupaauto
    ? SUPAAUTO_CATEGORIES
    : isSupadomus
      ? SUPADOMUS_CATEGORIES
      : SUPASIFIEDS_CATEGORIES;
  const getSubcategory = isSupaauto
    ? getSupaautoSubcategory
    : isSupadomus
      ? getSupadomusSubcategory
      : getSupasifiedsSubcategory;
  const sellerFromUrl = searchParams.get("seller") ?? "";

  const [listings, setListings] = useState<ClassifiedRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalLoaded, setTotalLoaded] = useState(false);
  const [totalAds, setTotalAds] = useState<number | null>(null);
  const [carouselAds, setCarouselAds] = useState<CarouselAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [country, setCountry] = useState("MY");
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);

  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isTypingSearch, setIsTypingSearch] = useState(false);
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [categoryDeep, setCategoryDeep] = useState("");
  const [sort, setSort] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);

  const selectedCat = CATEGORIES.find((c) => c.id === category);
  const selectedSub = category && subcategory ? getSubcategory(category, subcategory) : undefined;

  useEffect(() => {
    fetch("/api/geo")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCountry(d.data.code);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${apiBase}/stats?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && typeof d.data?.total === "number") setTotalAds(d.data.total);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${apiBase}/carousel?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data)) setCarouselAds(d.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (carouselAds.length <= 1 || carouselPaused) return;
    const timer = window.setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % carouselAds.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [carouselAds.length, carouselPaused]);

  useEffect(() => {
    if (!carouselAds.length) setCarouselIndex(0);
    else if (carouselIndex >= carouselAds.length) setCarouselIndex(0);
  }, [carouselAds.length, carouselIndex]);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        sort,
        country,
        ...(q && { q }),
        ...(category && { category }),
        ...(subcategory && { subcategory }),
        ...(categoryDeep && { category_deep: categoryDeep }),
        ...(sellerFromUrl && { seller: sellerFromUrl }),
      });
      const r = await fetch(`${apiBase}/listings?${params}`);
      const d = await r.json();
      if (d.success) {
        setListings(d.data.listings);
        setTotal(d.data.total);
        setTotalLoaded(true);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [page, q, category, subcategory, categoryDeep, sort, country, sellerFromUrl]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  useEffect(() => {
    const current = searchInput.trim();
    const active = q.trim();
    if (current === active) return;
    setIsTypingSearch(true);
    const timer = setTimeout(() => {
      setQ(current);
      setPage(1);
      setIsTypingSearch(false);
    }, 320);
    return () => clearTimeout(timer);
  }, [searchInput, q]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const v = searchInput.trim();
    setQ(v);
    setPage(1);
    setIsTypingSearch(false);
  };

  const resetFilters = () => {
    setCategory("");
    setSubcategory("");
    setCategoryDeep("");
    setQ("");
    setSearchInput("");
    setPage(1);
  };

  const hasFilters = Boolean(category || q || categoryDeep);
  const premiumPlacements = [...listings.filter((l) => l.is_boosted)].slice(0, 4);
  const premiumSlots = Array.from({ length: 4 }, (_, i) => premiumPlacements[i] ?? null);

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroTop}>
          <div className={styles.heroInner}>
            <div className={styles.heroBadge}>Classifieds · SupaCredits boost</div>
            <h1 className={styles.heroTitle}>📋 {isSupaauto ? "SupaAuto" : isSupadomus ? "SupaDomus" : "Supasifieds"}</h1>
            <p className={styles.heroSub}>
              Local classifieds made simple - no Pi escrow. Connect with sellers directly and boost your listings with SupaCredits.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexShrink: 0, marginTop: 4 }}>
            {user && (
              <Link href={`${appBase}/my-listings`} className={styles.hubBtn}>
                📂 My ads
              </Link>
            )}
            <Link href={`${appBase}/create`} className={styles.sellBtn} style={{ marginLeft: 0 }}>
              + Post ad
            </Link>
          </div>
        </div>

        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <span className={styles.heroStatNum}>{totalAds != null ? totalAds.toLocaleString() : "—"}</span>
            <span className={styles.heroStatLabel}>Active ads</span>
          </div>
          <div className={styles.heroStat}>
            <span className={styles.heroStatNum}>{totalLoaded ? total.toLocaleString() : "—"}</span>
            <span className={styles.heroStatLabel}>Search results</span>
          </div>
        </div>

        <form className={styles.searchRow} onSubmit={handleSearch}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              className={styles.searchInput}
              placeholder="Search ads..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button type="button" className={styles.searchClear} onClick={() => { setSearchInput(""); setQ(""); }}>
                ✕
              </button>
            )}
          </div>
          <button type="submit" className={styles.searchSubmitBtn}>
            Search
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${showFilters ? styles.filterBtnActive : ""}`}
            onClick={() => setShowFilters((p) => !p)}
          >
            ⚙️ {hasFilters ? "•" : ""}
          </button>
        </form>
        <div className={styles.searchHint}>
          {isTypingSearch ? "Typing..." : loading ? "Searching..." : q ? `Showing results for "${q}"` : "Search by title, description, or location"}
        </div>

        {country === "WORLDWIDE" && (
          <div className={styles.worldwideBanner}>🌍 All countries</div>
        )}

        {sellerFromUrl && (
          <div className={styles.worldwideBanner}>
            👤 Ads from{" "}
            <Link href={`/supaspace/${sellerFromUrl}`} className={styles.sellerFilterLink}>
              @{sellerFromUrl}
            </Link>
            {" · "}
            <Link href={appBase} className={styles.sellerFilterLink}>
              Show all
            </Link>
          </div>
        )}

        <div className={styles.catScroll}>
          <button
            type="button"
            className={`${styles.catPill} ${styles.catPillAll} ${!category ? styles.catPillActive : ""}`}
            onClick={() => {
              setCategory("");
              setSubcategory("");
              setCategoryDeep("");
              setPage(1);
            }}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.id}
              className={`${styles.catPill} ${category === c.id ? styles.catPillActive : ""}`}
              data-category={c.id}
              onClick={() => {
                setCategory(c.id);
                setSubcategory("");
                setCategoryDeep("");
                setPage(1);
              }}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </div>

      <section className={styles.contentSection}>
        <div className="container">
          {selectedCat && (
            <div className={styles.subCatWrap}>
              <button
                type="button"
                className={`${styles.subPill} ${!subcategory ? styles.subPillActive : ""}`}
                onClick={() => {
                  setSubcategory("");
                  setCategoryDeep("");
                  setPage(1);
                }}
              >
                All {selectedCat.label}
              </button>
              {selectedCat.subcategories.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className={`${styles.subPill} ${subcategory === s.id ? styles.subPillActive : ""}`}
                  onClick={() => {
                    setSubcategory(s.id);
                    setCategoryDeep("");
                    setPage(1);
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {selectedCat && subcategory && selectedSub && selectedSub.deep.length > 0 && (
            <div className={styles.deepCatWrap}>
              <button
                type="button"
                className={`${styles.deepPill} ${!categoryDeep ? styles.deepPillActive : ""}`}
                onClick={() => {
                  setCategoryDeep("");
                  setPage(1);
                }}
              >
                All types
              </button>
              {selectedSub.deep.map((d) => (
                <button
                  type="button"
                  key={d.id}
                  className={`${styles.deepPill} ${categoryDeep === d.id ? styles.deepPillActive : ""}`}
                  onClick={() => {
                    setCategoryDeep(d.id);
                    setPage(1);
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}

          {showFilters && (
            <div className={styles.filterPanel}>
              <div className={styles.filterPanelHead}>
                <div>
                  <div className={styles.filterPanelTitle}>Refine results</div>
                  <div className={styles.filterPanelHint}>Choose region and sorting preference</div>
                </div>
              </div>
              <div className={styles.filterGroup}>
                <div className={styles.filterLabel}>Country / region</div>
                <CountrySelect
                  value={country}
                  onChange={(code) => {
                    setCountry(code);
                    setPage(1);
                    setShowFilters(false);
                  }}
                />
              </div>
              <div className={styles.filterGroup}>
                <div className={styles.filterLabel}>Sort</div>
                <div className={styles.filterOptions}>
                  {SORT_OPTIONS.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      className={`${styles.filterOpt} ${sort === s.id ? styles.filterOptActive : ""}`}
                      onClick={() => {
                        setSort(s.id);
                        setPage(1);
                        setShowFilters(false);
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              {hasFilters && (
                <button
                  type="button"
                  className={styles.resetBtn}
                  onClick={() => {
                    resetFilters();
                    setShowFilters(false);
                  }}
                >
                  Reset filters
                </button>
              )}
            </div>
          )}

          <div className={styles.body}>
            {carouselAds.length > 0 && (
              <div className={styles.carouselCardWrap}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <strong style={{ color: "var(--color-text)" }}>🎠 Sponsored Carousel</strong>
                  <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Paid sponsor</span>
                </div>
                <div
                  className={styles.carouselViewport}
                  onMouseEnter={() => setCarouselPaused(true)}
                  onMouseLeave={() => setCarouselPaused(false)}
                  onTouchStart={() => setCarouselPaused(true)}
                  onTouchEnd={() => setCarouselPaused(false)}
                >
                  <div
                    className={styles.carouselTrack}
                    style={{ transform: `translateX(-${carouselIndex * 100}%)` }}
                  >
                    {carouselAds.map((ad) => (
                      <Link
                        key={ad.id}
                        href={ad.link_url}
                        target={ad.link_url.startsWith("http") ? "_blank" : undefined}
                        rel={ad.link_url.startsWith("http") ? "noopener noreferrer" : undefined}
                        className={styles.carouselSlide}
                      >
                        <div style={{ height: 120, background: "#f5f5f5" }}>
                          <img
                            src={ad.image_url}
                            alt={ad.headline}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          />
                        </div>
                        <div style={{ padding: 10, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              lineHeight: 1.3,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {ad.headline}
                          </div>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: "var(--color-gold-dark)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {ad.cta_label || "View"}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
                {carouselAds.length > 1 && (
                  <div className={styles.carouselDots}>
                    {carouselAds.map((ad, idx) => (
                      <button
                        key={ad.id}
                        type="button"
                        className={`${styles.carouselDot} ${idx === carouselIndex ? styles.carouselDotActive : ""}`}
                        aria-label={`Go to sponsored ad ${idx + 1}`}
                        onClick={() => setCarouselIndex(idx)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                background: "#fff",
                border: "1px solid var(--color-border)",
                borderRadius: 14,
                padding: 12,
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <strong style={{ color: "var(--color-text)" }}>⭐ Sponsored Listings</strong>
                <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Top 4 slots</span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 10,
                }}
              >
                {premiumSlots.map((slot, idx) =>
                  slot ? (
                    <Link
                      key={slot.id}
                      href={`${appBase}/${slot.id}`}
                      style={{
                        display: "block",
                        border: "1px solid #f2d08a",
                        borderRadius: 12,
                        overflow: "hidden",
                        background: "#fffaf0",
                        textDecoration: "none",
                        color: "inherit",
                      }}
                    >
                      <div style={{ position: "relative", height: 90, background: "#f5f5f5" }}>
                        {slot.images?.[0] ? (
                          <img
                            src={slot.images[0]}
                            alt={slot.title}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}>⭐</div>
                        )}
                        <span
                          style={{
                            position: "absolute",
                            top: 6,
                            left: 6,
                            fontSize: 10,
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: 999,
                            background: "rgba(26,26,46,0.8)",
                            color: "#fff",
                          }}
                        >
                          PREMIUM
                        </span>
                      </div>
                      <div style={{ padding: 8 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            lineHeight: 1.25,
                            minHeight: 30,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {slot.title}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, color: "var(--color-gold-dark)", fontWeight: 700 }}>
                          {formatPiPriceDisplay(slot.price_display, "Contact seller")}
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div
                      key={`slot-${idx}`}
                      style={{
                        border: "1px dashed #d6d6d6",
                        borderRadius: 12,
                        background: "#fafafa",
                        minHeight: 146,
                        display: "grid",
                        placeItems: "center",
                        textAlign: "center",
                        padding: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 20, marginBottom: 6 }}>📣</div>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>Premium slot #{idx + 1}</div>
                        <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Boost to appear here</div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className={styles.resultsHeader}>
              <span className={styles.resultsCount}>{loading ? "..." : `${total} ads`}</span>
              {hasFilters && (
                <button type="button" className={styles.clearFilters} onClick={resetFilters}>
                  Clear filters ✕
                </button>
              )}
            </div>

            {loading ? (
              <div className={styles.grid}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className={styles.skeleton} />
                ))}
              </div>
            ) : listings.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>📋</div>
                <div className={styles.emptyTitle}>No ads found</div>
                <div className={styles.emptyDesc}>Try different filters or be the first to post.</div>
                <Link href={`${appBase}/create`} className={styles.emptyBtn}>
                  + Post an ad
                </Link>
              </div>
            ) : (
              <>
                <div className={styles.grid}>
                  {listings.map((l) => (
                    <Link key={l.id} href={`${appBase}/${l.id}`} className={styles.card}>
                      <div className={styles.cardImg}>
                        {l.images?.[0] ? (
                          <img src={l.images[0]} alt={l.title} className={styles.cardImgEl} />
                        ) : (
                          <div className={styles.cardImgPlaceholder}>📋</div>
                        )}
                        <div className={styles.badgeStack}>
                          {l.is_boosted && (
                            <div className={styles.boostBadge}>
                              {l.boost_tier === "gold" ? "👑" : l.boost_tier === "silver" ? "🥈" : "🥉"} Boost
                            </div>
                          )}
                          {l.spotlight_expires_at && new Date(l.spotlight_expires_at) > new Date() && (
                            <div className={styles.boostBadge}>
                              ⭐ Spotlight
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={styles.cardBody}>
                        <div className={styles.cardTitle}>{l.title}</div>
                        <div className={styles.cardPrice}>{formatPiPriceDisplay(l.price_display)}</div>
                        <div className={styles.cardMeta}>
                          <span className={styles.cardCondition}>{l.views} views</span>
                          <div className={styles.cardIcons}>
                            {l.country_code && (
                              <span className={styles.cardIcon} title={getCountry(l.country_code).name}>
                                {getCountry(l.country_code).flag}
                              </span>
                            )}
                          </div>
                          {l.location && <span className={styles.cardLocation}>📍 {l.location}</span>}
                        </div>
                        <div className={styles.cardSeller}>
                          <div className={styles.sellerAvatar}>
                            {l.seller?.avatar_url ? (
                              <img src={l.seller.avatar_url} alt="" className={styles.sellerAvatarImg} />
                            ) : (
                              <span>{getInitial(l.seller?.username ?? "?")}</span>
                            )}
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
                    <button className={styles.pageBtn} disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                      ← Prev
                    </button>
                    <span className={styles.pageInfo}>
                      Page {page} of {Math.ceil(total / 20)}
                    </span>
                    <button
                      className={styles.pageBtn}
                      disabled={page >= Math.ceil(total / 20)}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}

            {user && listings.length > 0 && (
              <div className={styles.sellCta}>
                <div className={styles.sellCtaText}>Got something to sell or offer?</div>
                <Link href={`${appBase}/create`} className={styles.sellCtaBtn}>
                  + Post an ad
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function SupasifiedsPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.page}>
          <div className={styles.grid}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className={styles.skeleton} />
            ))}
          </div>
        </div>
      }
    >
      <SupasifiedsContent />
    </Suspense>
  );
}
