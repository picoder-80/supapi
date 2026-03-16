"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import styles from "../about/page.module.css";

export default function SupaDemyPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.heroBadge}>📚 SupaDemy</span>
        <h1 className={styles.heroTitle}>Learn & teach with Pi</h1>
        <p className={styles.heroSub}>Coming soon. Courses and learning on Pi.</p>
        <div className={styles.heroActions}>
          <Link href="/dashboard" className={styles.btnPrimary}>Back to Dashboard</Link>
        </div>
      </section>
    </div>
  );
}
