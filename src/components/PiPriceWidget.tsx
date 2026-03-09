"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./PiPriceWidget.module.css";

interface PriceData {
  usd: number;
  change24h: number;
  high24h: number;
  low24h: number;
  source: string;
}

export default function PiPriceWidget() {
  const router = useRouter();
  const [price, setPrice] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/pi/explorer?type=price");
        const d = await r.json();
        if (d.success) setPrice(d.data);
      } catch {}
      setLoading(false);
    };
    load();
    const t = setInterval(load, 60000); // refresh every 60s
    return () => clearInterval(t);
  }, []);

  const isUp = (price?.change24h ?? 0) >= 0;

  return (
    <div className={styles.widget} onClick={() => router.push("/pi-value")}>

      {/* Header row */}
      <div className={styles.widgetHeader}>
        <div className={styles.widgetLeft}>
          <div className={styles.piLogo}>π</div>
          <div>
            <div className={styles.widgetTitle}>Pi Network</div>
            <div className={styles.widgetSub}>Live Price</div>
          </div>
        </div>
        <div className={styles.widgetTap}>View Chart ›</div>
      </div>

      {/* Price + change */}
      {loading ? (
        <div className={styles.skeleton} />
      ) : price ? (
        <>
          <div className={styles.priceRow}>
            <div className={styles.priceUsd}>${price.usd.toFixed(4)}</div>
            <div className={`${styles.priceChange} ${isUp ? styles.up : styles.down}`}>
              {isUp ? "▲" : "▼"} {Math.abs(price.change24h).toFixed(2)}%
            </div>
          </div>

          {/* Stats */}
          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>24h High</div>
              <div className={styles.statValue}>${price.high24h.toFixed(4)}</div>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <div className={styles.statLabel}>24h Low</div>
              <div className={styles.statValue}>${price.low24h.toFixed(4)}</div>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <div className={styles.statLabel}>Source</div>
              <div className={styles.statValue}>{price.source}</div>
            </div>
          </div>
        </>
      ) : (
        <div className={styles.error}>Unable to fetch price</div>
      )}

    </div>
  );
}