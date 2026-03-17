"use client";

import Link from "next/link";
import styles from "./AdminPageHero.module.css";

type AdminPageHeroProps = {
  icon: string;
  title: string;
  subtitle: string;
  showBadge?: boolean;
  backHref?: string;
};

export default function AdminPageHero({ icon, title, subtitle, showBadge = false, backHref = "/admin/dashboard" }: AdminPageHeroProps) {
  return (
    <div className={styles.hero}>
      <div className={styles.heroContent}>
        <div className={styles.heroIcon}>{icon}</div>
        <div>
          <h1 className={styles.heroTitle}>{title}</h1>
          <p className={styles.heroSub}>{subtitle}</p>
        </div>
      </div>
      <div className={styles.heroRight}>
        {showBadge && (
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} />
            Live
          </div>
        )}
        <Link href={backHref} className={styles.backBtn}>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
