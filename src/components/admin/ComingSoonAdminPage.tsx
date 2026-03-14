"use client";

import Link from "next/link";
import styles from "./ComingSoonAdminPage.module.css";

type ComingSoonAdminPageProps = {
  icon: string;
  title: string;
  subtitle: string;
  panelName: string;
  features?: string[];
};

const DEFAULT_FEATURES = [
  "Overview & analytics",
  "Content moderation",
  "User management",
  "Settings & configuration",
  "Reports & export",
];

export default function ComingSoonAdminPage({
  icon,
  title,
  subtitle,
  panelName,
  features = DEFAULT_FEATURES,
}: ComingSoonAdminPageProps) {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <span className={styles.icon}>{icon}</span>
          <div>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.sub}>{subtitle}</p>
          </div>
        </div>
        <Link href="/admin/dashboard" className={`${styles.backBtn} ${styles.topBackBtn}`}>
          Back to Dashboard
        </Link>
      </div>

      <div className={styles.card}>
        <div className={styles.cardIcon}>🚧</div>
        <div className={styles.cardTitle}>Admin Panel Coming Soon</div>
        <div className={styles.cardSub}>The {panelName} admin panel is under development.</div>
        <div className={styles.featureList}>
          {features.map((f) => (
            <div key={f} className={styles.featureItem}>
              <span className={styles.dot}>◦</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.quickLinks}>
        <Link href="/admin/dashboard" className={`${styles.backBtn} ${styles.bottomBackBtn}`}>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
