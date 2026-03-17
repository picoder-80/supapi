"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./page.module.css";

const CATEGORIES = [
  { key: "food", label: "Food", emoji: "🍜" },
  { key: "retail", label: "Retail", emoji: "🛍️" },
  { key: "services", label: "Services", emoji: "🔧" },
  { key: "online", label: "Online", emoji: "💻" },
  { key: "stay", label: "SupaStay", emoji: "🏡" },
  { key: "transport", label: "Transport", emoji: "🚗" },
  { key: "other", label: "Other", emoji: "📍" },
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
  opening_hours?: { day: string; time: string }[];
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  users?: {
    username?: string;
    avatar_url?: string;
  } | null;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className={styles.stars} aria-label={`Rating ${rating.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= Math.round(rating) ? styles.starFilled : styles.starEmpty}>★</span>
      ))}
    </span>
  );
}

export default function LocatorBusinessDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const businessId = String(params?.id ?? "");

  const [business, setBusiness] = useState<Business | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchBusiness = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError("");
    try {
      let found: Business | null = null;

      // Keep API unchanged: reuse existing list endpoint and locate by id.
      for (let page = 1; page <= 8; page += 1) {
        const r = await fetch(`/api/locator?page=${page}`);
        const d = await r.json();
        if (!d?.success) break;
        const pageItems: Business[] = d.data ?? [];
        const match = pageItems.find((item) => item.id === businessId);
        if (match) {
          found = match;
          break;
        }
        if (pageItems.length < 20) break;
      }

      if (!found) {
        setError("Business not found or no longer available.");
        setBusiness(null);
        setReviews([]);
        setLoading(false);
        return;
      }

      setBusiness(found);

      const rr = await fetch(`/api/locator/${businessId}/reviews`);
      const rd = await rr.json();
      if (rd?.success) setReviews(rd.data ?? []);
      else setReviews([]);
    } catch {
      setError("Unable to load this business right now.");
    }
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    fetchBusiness();
  }, [fetchBusiness]);

  const coverImage = useMemo(() => {
    if (!business) return "";
    if (business.images?.length > 0) return business.images[0];
    return business.image_url || "";
  }, [business]);

  const category = useMemo(
    () => CATEGORIES.find((c) => c.key === business?.category),
    [business?.category]
  );

  const tags = useMemo(() => {
    if (!business) return [];
    const nextTags = [
      `${category?.emoji ?? "📍"} ${category?.label ?? "Business"}`,
      `📍 ${business.city}`,
      `🌍 ${business.country}`,
      "π Accepts Pi",
    ];
    if (business.verified) nextTags.push("✅ Verified");
    return nextTags;
  }, [business, category]);

  const todayIndex = new Date().getDay();
  const todayRow = (todayIndex + 6) % 7; // Monday-first index
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const openingHours = useMemo(() => {
    const raw = business?.opening_hours;
    if (Array.isArray(raw) && raw.length >= 7) {
      return raw.slice(0, 7).map((h: { day: string; time: string }) => ({
        day: h.day,
        time: (h.time || "").trim() || "Not provided",
      }));
    }
    return DAYS.map((d) => ({ day: d, time: "Not provided" }));
  }, [business?.opening_hours]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.heroSkeleton} />
        <div className={styles.content}>
          <div className={styles.cardSkeleton} />
          <div className={styles.actionSkeleton} />
          <div className={styles.cardSkeleton} />
          <div className={styles.cardSkeletonTall} />
        </div>
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className={styles.page}>
        <div className={styles.stateWrap}>
          <div className={styles.stateIcon}>📍</div>
          <h1 className={styles.stateTitle}>{error ? "Unable to open listing" : "Listing not found"}</h1>
          <p className={styles.stateText}>{error || "This business might have been removed."}</p>
          <div className={styles.stateActions}>
            <button className={styles.secondaryBtn} onClick={() => router.back()}>Back</button>
            <button className={styles.primaryBtn} onClick={fetchBusiness}>Try Again</button>
          </div>
        </div>
      </div>
    );
  }

  const hasCoords = business.lat !== null && business.lng !== null;
  const directionHref = hasCoords
    ? `https://www.google.com/maps?q=${business.lat},${business.lng}`
    : "https://maps.google.com";

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        {coverImage ? (
          <img src={coverImage} alt={business.name} className={styles.heroImage} />
        ) : (
          <div className={styles.heroFallback}>{category?.emoji ?? "📍"}</div>
        )}
        <div className={styles.heroOverlay} />
        <button className={styles.backBtn} onClick={() => router.back()} aria-label="Go back">←</button>
      </section>

      <div className={styles.content}>
        <section className={styles.infoCard}>
          <div className={styles.badgeRow}>
            <span className={styles.categoryBadge}>{category?.emoji ?? "📍"} {category?.label ?? "Business"}</span>
            {business.verified && <span className={styles.verifiedBadge}>✅ Verified</span>}
          </div>
          <h1 className={styles.name}>{business.name}</h1>
          <div className={styles.ratingRow}>
            <Stars rating={business.avg_rating || 0} />
            <span className={styles.ratingText}>{(business.avg_rating || 0).toFixed(1)}</span>
            <span className={styles.reviewCount}>({business.review_count} reviews)</span>
          </div>
          <div className={styles.tagsRow}>
            {tags.map((tag) => (
              <span key={tag} className={styles.tagChip}>{tag}</span>
            ))}
          </div>
        </section>

        <section className={styles.actionsCard}>
          <a href={business.phone ? `tel:${business.phone}` : "#"} className={styles.actionItem} aria-disabled={!business.phone}>
            <span className={styles.actionIcon}>📞</span>
            <span className={styles.actionLabel}>Call</span>
          </a>
          {business.phone && (
            <a
              href={`https://wa.me/${business.phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className={styles.actionItem}
            >
              <span className={styles.actionIcon}>💬</span>
              <span className={styles.actionLabel}>WhatsApp</span>
            </a>
          )}
          <a href={business.website || "#"} target="_blank" rel="noreferrer" className={styles.actionItem} aria-disabled={!business.website}>
            <span className={styles.actionIcon}>🌐</span>
            <span className={styles.actionLabel}>Website</span>
          </a>
          <a href={directionHref} target="_blank" rel="noreferrer" className={styles.actionItem}>
            <span className={styles.actionIcon}>🗺️</span>
            <span className={styles.actionLabel}>Directions</span>
          </a>
        </section>

        <section className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>About</h2>
          <p className={styles.sectionText}>{business.description || "No description provided yet."}</p>
          <p className={styles.metaText}>Established year: Not provided</p>
        </section>

        <section className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>Location</h2>
          <p className={styles.sectionText}>📍 {business.address}, {business.city}, {business.country}</p>
          <div className={styles.mapPlaceholder}>
            <span>📍 Map preview</span>
          </div>
        </section>

        <section className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>Opening Hours</h2>
          <ul className={styles.hoursList}>
            {openingHours.map((row, index) => (
              <li key={row.day} className={`${styles.hoursRow} ${index === todayRow ? styles.hoursRowToday : ""}`}>
                <span>{row.day}</span>
                <span>{row.time}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>Reviews</h2>
          {reviews.length === 0 ? (
            <p className={styles.sectionText}>No reviews yet. Be the first to leave one.</p>
          ) : (
            <div className={styles.reviewsList}>
              {reviews.map((review) => (
                <article key={review.id} className={styles.reviewItem}>
                  <div className={styles.reviewTop}>
                    {review.users?.avatar_url ? (
                      <img src={review.users.avatar_url} alt={review.users?.username || "Reviewer"} className={styles.avatar} />
                    ) : (
                      <div className={styles.avatarFallback}>
                        {(review.users?.username || "U").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className={styles.reviewMeta}>
                      <div className={styles.reviewName}>{review.users?.username || "Pioneer"}</div>
                      <div className={styles.reviewDate}>{new Date(review.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className={styles.reviewRating}>
                    <Stars rating={review.rating || 0} />
                    <span>{(review.rating || 0).toFixed(1)}</span>
                  </div>
                  <p className={styles.reviewComment}>{review.comment || "No comment provided."}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className={styles.stickyBar}>
        <a href={directionHref} target="_blank" rel="noreferrer" className={styles.stickyBtn}>
          Get Directions
        </a>
      </div>
    </div>
  );
}
