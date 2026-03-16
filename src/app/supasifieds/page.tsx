"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import styles from "../about/page.module.css";

export default function SupasifiedsPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.heroBadge}>📋 Supasifieds</span>
        <h1 className={styles.heroTitle}>Promote services & businesses</h1>
        <p className={styles.heroSub}>Coming soon. Classifieds and ads with Pi.</p>
        <div className={styles.heroActions}>
          <Link href="/dashboard" className={styles.btnPrimary}>Back to Dashboard</Link>
        </div>
      </section>
    </div>
  );
}
