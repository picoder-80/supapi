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
const MAX_REVIEW_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_REVIEW_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

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
  images?: string[];
  created_at: string;
  users?: {
    username?: string;
    avatar_url?: string;
  } | null;
}

interface OwnReview {
  id: string;
  rating: number;
  comment: string | null;
  images?: string[] | null;
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
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [myReview, setMyReview] = useState<OwnReview | null>(null);
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("supapi_token") : null;

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

      const rr = await fetch(`/api/locator/${businessId}/reviews`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const rd = await rr.json();
      const nextReviews = rd?.success ? (rd.data ?? []) : [];
      setReviews(nextReviews);
      setMyReview(rd?.my_review ?? null);
      if (rd?.my_review) {
        setReviewRating(Number(rd.my_review.rating || 5));
        setReviewComment(String(rd.my_review.comment || ""));
        setReviewImages(Array.isArray(rd.my_review.images) ? rd.my_review.images.filter(Boolean).slice(0, 4) : []);
      }

      if (nextReviews.length > 0) {
        const avg = nextReviews.reduce((sum: number, row: Review) => sum + Number(row.rating || 0), 0) / nextReviews.length;
        setBusiness((prev) =>
          prev
            ? {
                ...prev,
                avg_rating: Number(avg.toFixed(2)),
                review_count: nextReviews.length,
              }
            : prev
        );
      }
    } catch {
      setError("Unable to load this business right now.");
    }
    setLoading(false);
  }, [businessId, token]);

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
  const submitReview = async () => {
    if (!token) {
      setReviewMsg({ type: "error", text: "Sign in first to leave a review." });
      return;
    }
    if (reviewRating < 1 || reviewRating > 5) {
      setReviewMsg({ type: "error", text: "Please choose a rating from 1 to 5." });
      return;
    }

    setReviewSubmitting(true);
    setReviewMsg(null);
    try {
      const res = await fetch(`/api/locator/${businessId}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating: reviewRating,
          comment: reviewComment.trim(),
          images: reviewImages,
        }),
      });
      const data = await res.json();
      if (!data?.success) {
        setReviewMsg({ type: "error", text: data?.error || "Failed to submit review." });
        setReviewSubmitting(false);
        return;
      }
      setReviewMsg({ type: "success", text: myReview ? "Review updated." : "Review submitted." });
      await fetchBusiness();
    } catch {
      setReviewMsg({ type: "error", text: "Failed to submit review." });
    }
    setReviewSubmitting(false);
  };

  const handleReviewImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (!token) {
      setReviewMsg({ type: "error", text: "Sign in first to upload photos." });
      return;
    }
    const remain = Math.max(0, 4 - reviewImages.length);
    if (remain <= 0) {
      setReviewMsg({ type: "error", text: "Maximum 4 photos per review." });
      return;
    }
    setUploadingImages(true);
    setReviewMsg(null);
    const next: string[] = [];
    try {
      for (const file of files.slice(0, remain)) {
        if (!ALLOWED_REVIEW_IMAGE_TYPES.has(file.type)) {
          throw new Error("Only JPG, PNG, WEBP, or GIF images are allowed");
        }
        if (file.size > MAX_REVIEW_IMAGE_SIZE) {
          throw new Error("Each image must be 2MB or smaller");
        }
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/locator/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const data = await res.json();
        if (!data?.success || !data?.url) {
          throw new Error(data?.error || "Failed to upload image");
        }
        next.push(String(data.url));
      }
      setReviewImages((prev) => [...prev, ...next].slice(0, 4));
    } catch (err: any) {
      setReviewMsg({ type: "error", text: err?.message || "Failed to upload image." });
    }
    setUploadingImages(false);
    e.currentTarget.value = "";
  };

  const removeReviewImage = (index: number) => {
    setReviewImages((prev) => prev.filter((_, i) => i !== index));
  };

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
          <div className={styles.reviewComposer}>
            <div className={styles.reviewComposerHead}>{myReview ? "Edit your review" : "Leave a review"}</div>
            <div className={styles.reviewPicker}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setReviewRating(n)}
                  className={`${styles.rateBtn} ${reviewRating >= n ? styles.rateBtnActive : ""}`}
                  aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
                >
                  ★
                </button>
              ))}
              <span className={styles.rateText}>{reviewRating}/5</span>
            </div>
            <textarea
              className={styles.reviewInput}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={3}
              placeholder="Share your experience (optional)"
              maxLength={400}
            />
            <div className={styles.reviewImageRow}>
              <label className={styles.uploadPhotoBtn}>
                {uploadingImages ? "Uploading..." : "+ Add photo"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleReviewImagePick}
                  className={styles.hiddenInput}
                  disabled={uploadingImages || reviewImages.length >= 4}
                />
              </label>
              <span className={styles.imageHint}>{reviewImages.length}/4 photos</span>
            </div>
            {reviewImages.length > 0 && (
              <div className={styles.reviewPhotoGrid}>
                {reviewImages.map((url, idx) => (
                  <div key={`${url}-${idx}`} className={styles.reviewPhotoItem}>
                    <img src={url} alt={`Review ${idx + 1}`} className={styles.reviewPhoto} />
                    <button
                      type="button"
                      className={styles.removePhotoBtn}
                      onClick={() => removeReviewImage(idx)}
                      aria-label="Remove photo"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.reviewComposerFoot}>
              <span className={styles.charCount}>{reviewComment.length}/400</span>
              <button
                type="button"
                onClick={submitReview}
                className={styles.submitReviewBtn}
                disabled={reviewSubmitting}
              >
                {reviewSubmitting ? "Submitting..." : myReview ? "Update Review" : "Submit Review"}
              </button>
            </div>
            {reviewMsg && (
              <div className={reviewMsg.type === "success" ? styles.reviewMsgSuccess : styles.reviewMsgError}>
                {reviewMsg.text}
              </div>
            )}
          </div>
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
                  {Array.isArray(review.images) && review.images.length > 0 && (
                    <div className={styles.reviewThumbs}>
                      {review.images.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer" className={styles.reviewThumbLink}>
                          <img src={url} alt="" className={styles.reviewThumb} />
                        </a>
                      ))}
                    </div>
                  )}
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
