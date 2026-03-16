"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import styles from "../about/page.module.css";

export default function SupaHiroPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.heroBadge}>🧑‍💻 SupaHiro</span>
        <h1 className={styles.heroTitle}>Hire & get hired with Pi</h1>
        <p className={styles.heroSub}>Coming soon. Jobs and talent on Pi.</p>
        <div className={styles.heroActions}>
          <Link href="/dashboard" className={styles.btnPrimary}>Back to Dashboard</Link>
        </div>
      </section>
    </div>
  );
}
