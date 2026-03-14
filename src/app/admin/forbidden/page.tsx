"use client";

import Link from "next/link";
import styles from "./page.module.css";

export default function AdminForbiddenPage() {
  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link href="/admin/dashboard" className={`${styles.btn} ${styles.topBackBtn}`}>Back to Dashboard</Link>
      </div>

      <div className={styles.centerWrap}>
        <div className={styles.card}>
          <div className={styles.icon}>⛔</div>
          <h1 className={styles.title}>Access Denied</h1>
          <p className={styles.sub}>Your admin role does not have permission to open this module.</p>
          <div className={styles.actions}>
            <Link href="/admin/dashboard" className={styles.btn}>Back to Dashboard</Link>
            <Link href="/admin/settings" className={styles.btnAlt}>Open Settings</Link>
          </div>
        </div>
      </div>

      <div className={styles.quickLinks}>
        <Link href="/admin/dashboard" className={`${styles.btn} ${styles.bottomBackBtn}`}>Back to Dashboard</Link>
      </div>
    </div>
  );
}
