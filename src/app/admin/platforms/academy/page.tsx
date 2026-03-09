"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import styles from "./page.module.css";

const FEATURES = [
  "Overview & analytics",
  "Content moderation", 
  "User management",
  "Settings & configuration",
  "Reports & export",
];

export default function PlatformAdminPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.icon}>📚</span>
        <div>
          <h1 className={styles.title}>Academy</h1>
          <p className={styles.sub}>Online courses & learning</p>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardIcon}>🚧</div>
        <div className={styles.cardTitle}>Admin Panel Coming Soon</div>
        <div className={styles.cardSub}>The Academy admin panel is under development.</div>
        <div className={styles.featureList}>
          {FEATURES.map(f => (
            <div key={f} className={styles.featureItem}>
              <span className={styles.dot}>◦</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      <Link href="/admin/dashboard" className={styles.backBtn}>← Back to Dashboard</Link>
    </div>
  );
}