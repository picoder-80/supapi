"use client";

import Link from "next/link";
import AdminPageHero from "./AdminPageHero";
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
    <div className="adminPage">
      <AdminPageHero icon={icon} title={title} subtitle={subtitle} />

      <div className={`adminContentCard ${styles.comingSoonCard}`}>
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

      <div className="adminQuickLinks">
        <Link href="/admin/dashboard" className="adminBackBtn">Back to Dashboard</Link>
      </div>
    </div>
  );
}
