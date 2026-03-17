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
  { key: "stay",      label: "SupaStay",  emoji: "🏡" },
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
  images: string[];
  verified: boolean;
  avg_rating: number;
  review_count: number;
  distance?: number;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className={styles.stars}>
      {[1,2,3,4,5].map(i => (
        <span key={i} className={i <= Math.round(rating) ? styles.starFilled : styles.starEmpty}>★</span>
      ))}
    </span>
  );
}

function BusinessCard({ b, onClick, onViewDetails }: { b: Business; onClick: () => void; onViewDetails: () => void }) {
  const cat = CATEGORIES.find(c => c.key === b.category);
  const cover = (b.images?.length ? b.images[0] : b.image_url) || "";
  const tags = [
    `π Accepts Pi`,
    `${cat?.emoji ?? "📍"} ${cat?.label ?? "Business"}`,
    b.country,
    ...(b.verified ? ["✅ Verified"] : []),
  ];
  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.cardImageWrap}>
        {cover
          ? <img src={cover} alt={b.name} className={styles.cardImage} />
          : <div className={styles.cardImagePlaceholder}>{cat?.emoji ?? "📍"}</div>
        }
        <div className={styles.cardCatBadge}>{cat?.emoji ?? "📍"} {cat?.label ?? "Business"}</div>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardName}>{b.name}</div>
        <p className={styles.cardDesc}>{b.description || "No description provided yet."}</p>
        {b.avg_rating > 0 && (
          <div className={styles.cardRating}>
            <Stars rating={b.avg_rating} />
            <span className={styles.cardRatingNum}>{b.avg_rating.toFixed(1)}</span>
            <span className={styles.cardRatingCount}>({b.review_count} reviews)</span>
          </div>
        )}
        <div className={styles.cardAddr}>📍 {b.city}, {b.country}</div>
        <div className={styles.cardTags}>
          {tags.map((tag) => (
            <span key={tag} className={styles.cardTag}>{tag}</span>
          ))}
        </div>
        <div className={styles.cardBottomRow}>
          <button
            type="button"
            className={styles.cardGhostBtn}
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails();
            }}
          >
            View Details
          </button>
          {b.distance !== undefined && b.distance < 9999 ? (
            <span className={styles.cardDistance}>📏 {b.distance.toFixed(1)} km</span>
          ) : (
            <span className={styles.cardDistanceMuted}>Distance unavailable</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LocatorPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("all");
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [page, setPage] = useState(1);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (category !== "all") params.set("category", category);
      if (q) params.set("q", q);
      if (userLat) params.set("lat", String(userLat));
      if (userLng) params.set("lng", String(userLng));
      const r = await fetch(`/api/locator?${params}`);
      const d = await r.json();
      if (d.success) setBusinesses(d.data);
      else setError(d.error ?? "Unable to load businesses right now.");
    } catch {
      setError("Unable to load businesses right now.");
    }
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

  // Init Leaflet map (free, no API key needed)
  useEffect(() => {
    if (view !== "map" || !mapRef.current) return;
    if (leafletRef.current) return;

    // Load Leaflet CSS
    if (!document.querySelector("link[href*='leaflet']")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(link);
    }

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.onload = () => {
      const L = (window as any).L;

      const map = L.map(mapRef.current, { zoomControl: true }).setView(
        [userLat ?? 3.147, userLng ?? 101.693], 13
      );

      // CartoDB Positron — clean, modern, free tile layer
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      leafletRef.current = map;

      // User location marker (gold pulse)
      if (userLat && userLng) {
        const userIcon = L.divIcon({
          html: `<div style="width:18px;height:18px;background:#F5A623;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(245,166,35,0.3)"></div>`,
          className: "",
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        userMarkerRef.current = L.marker([userLat, userLng], { icon: userIcon })
          .addTo(map)
          .bindPopup("<b>You are here</b>");
      }

      // Business markers with emoji + popup
      businesses.forEach(b => {
        if (!b.lat || !b.lng) return;
        const cat = CATEGORIES.find(c => c.key === b.category);
        const icon = L.divIcon({
          html: `<div style="background:#1A1A2E;border:2.5px solid #F5A623;border-radius:50% 50% 50% 0;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 3px 10px rgba(0,0,0,0.35);transform:rotate(-45deg)"><span style="transform:rotate(45deg)">${cat?.emoji ?? "📍"}</span></div>`,
          className: "",
          iconSize: [36, 36],
          iconAnchor: [10, 36],
          popupAnchor: [8, -36],
        });

        const popupHtml = `
          <div style="font-family:-apple-system,sans-serif;min-width:180px;padding:2px">
            <div style="font-weight:800;font-size:14px;color:#1A1A2E;margin-bottom:4px">${b.name}</div>
            ${b.image_url ? `<img src="${b.image_url}" style="width:100%;height:80px;object-fit:cover;border-radius:8px;margin-bottom:6px">` : ""}
            <div style="font-size:12px;color:#718096;margin-bottom:4px">📍 ${b.address}, ${b.city}</div>
            ${b.avg_rating > 0 ? `<div style="font-size:12px;margin-bottom:4px">⭐ ${b.avg_rating.toFixed(1)} (${b.review_count} reviews)</div>` : ""}
            <div style="font-size:11px;font-weight:700;color:#F5A623;margin-bottom:6px">π Accepts Pi</div>
            <button onclick="window.__selectBusiness('${b.id}')" style="background:#F5A623;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;width:100%">View Details</button>
          </div>`;

        const marker = L.marker([b.lat, b.lng], { icon })
          .addTo(map)
          .bindPopup(popupHtml, { maxWidth: 220 });
        markersRef.current.push(marker);
      });

      // Global handler for popup button
      (window as any).__selectBusiness = (id: string) => {
        router.push(`/locator/${id}`);
      };
    };
    document.head.appendChild(script);

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      leafletRef.current?.remove();
      leafletRef.current = null;
      delete (window as any).__selectBusiness;
    };
  }, [view, router]);

  // Keep user marker in sync after location updates
  useEffect(() => {
    if (view !== "map" || !leafletRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    userMarkerRef.current?.remove();
    userMarkerRef.current = null;

    if (!userLat || !userLng) return;

    const userIcon = L.divIcon({
      html: `<div style="width:18px;height:18px;background:#F5A623;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(245,166,35,0.3)"></div>`,
      className: "",
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    userMarkerRef.current = L.marker([userLat, userLng], { icon: userIcon })
      .addTo(leafletRef.current)
      .bindPopup("<b>You are here</b>");

    // Keep map centered on latest detected location.
    leafletRef.current.setView([userLat, userLng], Math.max(leafletRef.current.getZoom?.() ?? 13, 13));
  }, [view, userLat, userLng]);

  // Refresh markers when businesses change
  useEffect(() => {
    if (view !== "map") return;
    if (!leafletRef.current) return;
    const L = (window as any).L;
    if (!L) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    businesses.forEach(b => {
      if (!b.lat || !b.lng) return;
      const cat = CATEGORIES.find(c => c.key === b.category);
      const icon = L.divIcon({
        html: `<div style="background:#1A1A2E;border:2.5px solid #F5A623;border-radius:50% 50% 50% 0;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 3px 10px rgba(0,0,0,0.35);transform:rotate(-45deg)"><span style="transform:rotate(45deg)">${cat?.emoji ?? "📍"}</span></div>`,
        className: "",
        iconSize: [36, 36],
        iconAnchor: [10, 36],
        popupAnchor: [8, -36],
      });
      const popupHtml = `
        <div style="font-family:-apple-system,sans-serif;min-width:180px;padding:2px">
          <div style="font-weight:800;font-size:14px;color:#1A1A2E;margin-bottom:4px">${b.name}</div>
          ${b.image_url ? `<img src="${b.image_url}" style="width:100%;height:80px;object-fit:cover;border-radius:8px;margin-bottom:6px">` : ""}
          <div style="font-size:12px;color:#718096;margin-bottom:4px">📍 ${b.address}, ${b.city}</div>
          ${b.avg_rating > 0 ? `<div style="font-size:12px;margin-bottom:4px">⭐ ${b.avg_rating.toFixed(1)} (${b.review_count} reviews)</div>` : ""}
          <div style="font-size:11px;font-weight:700;color:#F5A623;margin-bottom:6px">π Accepts Pi</div>
          <button onclick="window.__selectBusiness('${b.id}')" style="background:#F5A623;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;width:100%">View Details</button>
        </div>`;
      const marker = L.marker([b.lat, b.lng], { icon })
        .addTo(leafletRef.current)
        .bindPopup(popupHtml, { maxWidth: 220 });
      markersRef.current.push(marker);
    });
    (window as any).__selectBusiness = (id: string) => {
      router.push(`/locator/${id}`);
    };
  }, [view, businesses, router]);

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.headerTitle}>📍 Pi Locator</h1>
          <div className={styles.headerBtns}>
            <button className={styles.myListingsBtn} onClick={() => router.push("/locator/my")}>My Listings</button>
            <button className={styles.registerBtn} onClick={() => router.push("/locator/register")}>+ Register</button>
          </div>
        </div>

        {/* Search */}
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

      {/* Results count */}
      <div className={styles.resultsBar}>
        <span className={styles.resultsCount}>
          {loading ? <span className={styles.resultsSkeleton}>Loading results...</span> : `${businesses.length} businesses found`}
        </span>
        {userLat && <span className={styles.nearMe}>🎯 Near me</span>}
      </div>

      {/* Map View */}
      {view === "map" && (
        <div className={styles.mapWrap}>
          {loading && <div className={styles.mapSkeleton}>Loading map...</div>}
          <div ref={mapRef} className={styles.map} />
        </div>
      )}

      {/* List View */}
      {view === "list" && (
        <div className={styles.body}>
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className={styles.skeletonCard}>
                <div className={styles.skeletonImage} />
                <div className={styles.skeletonBody}>
                  <div className={styles.skeletonLineLg} />
                  <div className={styles.skeletonLineMd} />
                  <div className={styles.skeletonLineSm} />
                </div>
              </div>
            ))
          ) : error ? (
            <div className={styles.stateCard}>
              <div className={styles.emptyIcon}>⚠️</div>
              <div className={styles.emptyTitle}>Something went wrong</div>
              <div className={styles.emptySub}>{error}</div>
              <div className={styles.stateActions}>
                <button className={styles.secondaryBtn} onClick={() => router.back()}>Back</button>
                <button className={styles.emptyBtn} onClick={fetchBusinesses}>Try Again</button>
              </div>
            </div>
          ) : businesses.length === 0 ? (
            <div className={styles.stateCard}>
              <div className={styles.emptyIcon}>📍</div>
              <div className={styles.emptyTitle}>No businesses found</div>
              <div className={styles.emptySub}>Be the first to register your business!</div>
              <div className={styles.stateActions}>
                <button className={styles.secondaryBtn} onClick={() => router.back()}>Back</button>
                <button className={styles.emptyBtn} onClick={() => router.push("/locator/register")}>+ Register Business</button>
              </div>
            </div>
          ) : (
            <>
              <div className={styles.grid}>
                {businesses.map(b => (
                  <BusinessCard
                    key={b.id}
                    b={b}
                    onClick={() => router.push(`/locator/${b.id}`)}
                    onViewDetails={() => router.push(`/locator/${b.id}`)}
                  />
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

    </div>
  );
}