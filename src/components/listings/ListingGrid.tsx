"use client";

// components/listings/ListingGrid.tsx

import { useEffect, useState } from "react";
import type { Listing } from "@/types";
import styles from "./ListingGrid.module.css";

export default function ListingGrid() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/listings")
      .then((r) => r.json())
      .then((d) => { if (d.success) setListings(d.data.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.loading}>Loading listings...</div>;

  if (!listings.length)
    return <div className={styles.empty}>No listings yet. Be the first to post! 🎉</div>;

  return (
    <div className={styles.grid}>
      {listings.map((l) => (
        <a key={l.id} href={`/market/${l.id}`} className={styles.card}>
          {l.is_featured && <span className={styles.featured}>⭐ Featured</span>}
          <div className={styles.img}>
            {l.images[0]
              ? <img src={l.images[0]} alt={l.title} />
              : <div className={styles.imgPlaceholder}>📦</div>
            }
          </div>
          <div className={styles.body}>
            <p className={styles.cardTitle}>{l.title}</p>
            <p className={styles.price}>π {l.price_pi.toFixed(2)}</p>
            <div className={styles.meta}>
              <span className={styles.category}>{l.category}</span>
              {l.location && <span className={styles.location}>📍 {l.location}</span>}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
