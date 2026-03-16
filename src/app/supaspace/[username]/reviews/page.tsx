"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import styles from "../../page.module.css";

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }
function formatDate(d: string) { return new Date(d).toLocaleDateString("en-MY", { month: "long", year: "numeric" }); }

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  platform: string;
  reviewer: { id: string; username: string; display_name: string | null; avatar_url: string | null };
}

export default function ReviewsPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const [profile, setProfile] = useState<{ display_name: string | null } | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const f = async () => {
      setLoading(true);
      try {
        const [userRes, reviewsRes] = await Promise.all([
          fetch(`/api/users/${username}`),
          fetch(`/api/supaspace/reviews/${encodeURIComponent(username)}`),
        ]);
        const userData = await userRes.json();
        const reviewsData = await reviewsRes.json();
        if (userData.success) setProfile(userData.data.user);
        else setNotFound(true);
        if (reviewsData.success) setReviews(reviewsData.data?.reviews ?? []);
      } catch {
        setNotFound(true);
      }
      setLoading(false);
    };
    f();
  }, [username]);

  const name = profile?.display_name ?? username;
  const avgRating = reviews.length > 0
    ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1)
    : "5.0";

  if (notFound) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🔍</div>
          <div className={styles.emptyTitle}>Profile not found</div>
          <Link href="/supaspace" className={styles.emptyBtn}>Back to SupaSpace</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.followListHeader}>
        <Link href={`/supaspace/${username}`} className={styles.followListBack}>← Profile</Link>
        <h1 className={styles.followListTitle}>Ratings for @{username}</h1>
        <p className={styles.followListSub}>
          {reviews.length} {reviews.length === 1 ? "review" : "reviews"} · Avg {avgRating}⭐
        </p>
      </div>
      <div className={styles.body}>
        {loading ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>⏳</div>
            <div className={styles.emptyTitle}>Loading reviews...</div>
          </div>
        ) : reviews.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>⭐</div>
            <div className={styles.emptyTitle}>No reviews yet</div>
            <div className={styles.emptyDesc}>Reviews from SupaMarket, SupaSkil, SupaDemy, SupaDomus & profile will appear here.</div>
            <Link href={`/supaspace/${username}`} className={styles.emptyBtn}>Back to Profile</Link>
          </div>
        ) : (
          <div className={styles.reviewList}>
            {reviews.map((r) => (
              <div key={r.id} className={styles.reviewCard}>
                <div className={styles.reviewHeader}>
                  <Link href={`/supaspace/${r.reviewer.username}`}>
                    <div className={styles.reviewAvatar}>
                      {r.reviewer.avatar_url ? <img src={r.reviewer.avatar_url} alt="" /> : getInitial(r.reviewer.username)}
                    </div>
                  </Link>
                  <div className={styles.reviewHeaderMeta}>
                    <div className={styles.reviewerName}>
                      <Link href={`/supaspace/${r.reviewer.username}`}>{r.reviewer.display_name ?? r.reviewer.username}</Link>
                      <span className={styles.reviewPlatform}> · {r.platform}</span>
                    </div>
                    <div className={styles.reviewDate}>{formatDate(r.created_at)}</div>
                  </div>
                </div>
                <div className={styles.reviewStars}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className={i <= r.rating ? styles.starFilled : styles.starEmpty}>★</span>
                  ))}
                </div>
                {r.comment && <div className={styles.reviewText}>{r.comment}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
