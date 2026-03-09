"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

const CATEGORIES = [
  { key: "all",       label: "All",       emoji: "🗺️" },
  { key: "food",      label: "Food",      emoji: "🍜" },
  { key: "retail",    label: "Retail",    emoji: "🛍️" },
  { key: "services",  label: "Services",  emoji: "🔧" },
  { key: "online",    label: "Online",    emoji: "💻" },
  { key: "stay",      label: "Stay",      emoji: "🏡" },
  { key: "transport", label: "Transport", emoji: "🚗" },
  { key: "other",     label: "Other",     emoji: "📍" },
];

interface Business {
  id: string;
  name: string;
  category: string;
  description: string;
  address: string;
  city: string;
  country: string;
  lat: number | null;
  lng: number | null;
  phone: string;
  website: string;
  image_url: string;
  verified: boolean;
  avg_rating: number;
  review_count: number;
  distance?: number;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className={styles.stars}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= Math.round(rating) ? "#F5A623" : "#ddd" }}>★</span>
      ))}
    </span>
  );
}

function BusinessCard({ b, onClick }: { b: Business; onClick: () => void }) {
  const cat = CATEGORIES.find(c => c.key === b.category);
  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.cardImageWrap}>
        {b.image_url
          ? <img src={b.image_url} alt={b.name} className={styles.cardImage} />
          : <div className={styles.cardImagePlaceholder}>{cat?.emoji ?? "📍"}</div>
        }
        {b.verified && <div className={styles.verifiedBadge}>✅ Verified</div>}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <div className={styles.cardName}>{b.name}</div>
          <div className={styles.cardCat}>{cat?.emoji} {cat?.label}</div>
        </div>
        <div className={styles.cardAddr}>📍 {b.address}, {b.city}</div>
        {b.avg_rating > 0 && (
          <div className={styles.cardRating}>
            <Stars rating={b.avg_rating} />
            <span className={styles.cardRatingNum}>{b.avg_rating.toFixed(1)}</span>
            <span className={styles.cardRatingCount}>({b.review_count})</span>
          </div>
        )}
        {b.distance !== undefined && b.distance < 9999 && (
          <div className={styles.cardDistance}>📏 {b.distance.toFixed(1)} km away</div>
        )}
        <div className={styles.cardPi}>π Accepts Pi</div>
      </div>
    </div>
  );
}

export default function LocatorPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Business | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (category !== "all") params.set("category", category);
      if (q) params.set("q", q);
      if (userLat) params.set("lat", String(userLat));
      if (userLng) params.set("lng", String(userLng));
      const r = await fetch(`/api/locator?${params}`);
      const d = await r.json();
      if (d.success) setBusinesses(d.data);
    } catch {}
    setLoading(false);
  }, [category, q, userLat, userLng, page]);

  useEffect(() => { fetchBusinesses(); }, [fetchBusinesses]);

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setLocating(false);
      },
      () => setLocating(false)
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQ(searchInput);
    setPage(1);
  };

  // Init Leaflet map
  useEffect(() => {
    if (view !== "map" || !mapRef.current) return;
    if (leafletRef.current) return;

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.onload = () => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(link);

      const L = (window as any).L;
      const map = L.map(mapRef.current).setView(
        [userLat ?? 3.147, userLng ?? 101.693], 12
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap"
      }).addTo(map);
      leafletRef.current = map;

      // Add markers
      businesses.forEach(b => {
        if (!b.lat || !b.lng) return;
        const marker = L.marker([b.lat, b.lng])
          .addTo(map)
          .bindPopup(`<b>${b.name}</b><br>${b.address}`);
        markersRef.current.push(marker);
      });

      if (userLat && userLng) {
        L.circleMarker([userLat, userLng], { radius: 8, color: "#F5A623", fillOpacity: 0.9 })
          .addTo(map)
          .bindPopup("You are here");
      }
    };
    document.head.appendChild(script);

    return () => { leafletRef.current?.remove(); leafletRef.current = null; };
  }, [view]);

  // Update markers when businesses change
  useEffect(() => {
    if (!leafletRef.current) return;
    const L = (window as any).L;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    businesses.forEach(b => {
      if (!b.lat || !b.lng) return;
      const marker = L.marker([b.lat, b.lng])
        .addTo(leafletRef.current)
        .bindPopup(`<b>${b.name}</b><br>${b.address}`);
      markersRef.current.push(marker);
    });
  }, [businesses]);

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.headerTitle}>📍 Pi Locator</h1>
            <div className={styles.headerSub}>Find businesses that accept Pi</div>
          </div>
          <button
            className={styles.registerBtn}
            onClick={() => router.push("/locator/register")}
          >+ Register</button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className={styles.searchRow}>
          <div className={styles.searchBox}>
            <span>🔍</span>
            <input
              className={styles.searchInput}
              placeholder="Search businesses..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={`${styles.locateBtn} ${userLat ? styles.locateBtnActive : ""}`}
            onClick={handleLocate}
          >{locating ? "⏳" : "🎯"}</button>
        </form>

        {/* Category filter */}
        <div className={styles.categories}>
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              className={`${styles.catBtn} ${category === c.key ? styles.catBtnActive : ""}`}
              onClick={() => { setCategory(c.key); setPage(1); }}
            >{c.emoji} {c.label}</button>
          ))}
        </div>

        {/* View toggle */}
        <div className={styles.viewToggle}>
          <button className={`${styles.viewBtn} ${view === "list" ? styles.viewBtnActive : ""}`} onClick={() => setView("list")}>
            ☰ List
          </button>
          <button className={`${styles.viewBtn} ${view === "map" ? styles.viewBtnActive : ""}`} onClick={() => setView("map")}>
            🗺️ Map
          </button>
        </div>
      </div>

      {/* Results count */}
      <div className={styles.resultsBar}>
        <span className={styles.resultsCount}>
          {loading ? "Loading..." : `${businesses.length} businesses found`}
        </span>
        {userLat && <span className={styles.nearMe}>🎯 Near me</span>}
      </div>

      {/* Map View */}
      {view === "map" && (
        <div ref={mapRef} className={styles.map} />
      )}

      {/* List View */}
      {view === "list" && (
        <div className={styles.body}>
          {loading ? (
            [...Array(4)].map((_, i) => <div key={i} className={styles.skeleton} />)
          ) : businesses.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📍</div>
              <div className={styles.emptyTitle}>No businesses found</div>
              <div className={styles.emptySub}>Be the first to register your business!</div>
              <button className={styles.emptyBtn} onClick={() => router.push("/locator/register")}>
                + Register Business
              </button>
            </div>
          ) : (
            <>
              <div className={styles.grid}>
                {businesses.map(b => (
                  <BusinessCard key={b.id} b={b} onClick={() => setSelected(b)} />
                ))}
              </div>
              {businesses.length === 20 && (
                <button className={styles.loadMore} onClick={() => setPage(p => p + 1)}>
                  Load more
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Business Detail Sheet */}
      {selected && (
        <div className={styles.overlay} onClick={() => setSelected(null)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetHeader}>
              <div className={styles.sheetName}>{selected.name}</div>
              <button className={styles.sheetClose} onClick={() => setSelected(null)}>✕</button>
            </div>

            {selected.image_url && (
              <img src={selected.image_url} alt={selected.name} className={styles.sheetImage} />
            )}

            <div className={styles.sheetBody}>
              {selected.verified && (
                <div className={styles.sheetVerified}>✅ Verified Pi Merchant</div>
              )}
              <div className={styles.sheetPiBadge}>π Accepts Pi Payment</div>

              {selected.avg_rating > 0 && (
                <div className={styles.sheetRating}>
                  <Stars rating={selected.avg_rating} />
                  <span>{selected.avg_rating.toFixed(1)} ({selected.review_count} reviews)</span>
                </div>
              )}

              {selected.description && (
                <p className={styles.sheetDesc}>{selected.description}</p>
              )}

              <div className={styles.sheetInfoList}>
                <div className={styles.sheetInfo}><span>📍</span>{selected.address}, {selected.city}</div>
                {selected.phone && <div className={styles.sheetInfo}><span>📞</span>
                  <a href={`tel:${selected.phone}`}>{selected.phone}</a>
                </div>}
                {selected.website && <div className={styles.sheetInfo}><span>🌐</span>
                  <a href={selected.website} target="_blank" rel="noreferrer">{selected.website}</a>
                </div>}
                {selected.distance !== undefined && selected.distance < 9999 && (
                  <div className={styles.sheetInfo}><span>📏</span>{selected.distance.toFixed(1)} km from you</div>
                )}
              </div>

              {selected.lat && selected.lng && (
                <a
                  href={`https://www.google.com/maps?q=${selected.lat},${selected.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.directionBtn}
                >🗺️ Get Directions</a>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}