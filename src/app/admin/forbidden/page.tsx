"use client";

import Link from "next/link";
import AdminPageHero from "@/components/admin/AdminPageHero";
import styles from "./page.module.css";

export default function AdminForbiddenPage() {
  return (
    <div className="adminPage">
      <AdminPageHero
        icon="⛔"
        title="Access Denied"
        subtitle="Your admin role does not have permission to open this module."
      />

      <div className={styles.centerWrap}>
        <div className={`adminContentCard ${styles.card}`} style={{ maxWidth: 520, textAlign: "center" }}>
          <div className={styles.icon}>⛔</div>
          <h1 className={styles.title}>Access Denied</h1>
          <p className={styles.sub}>Your admin role does not have permission to open this module.</p>
          <div className={styles.actions}>
            <Link href="/admin/dashboard" className="adminBackBtn">Back to Dashboard</Link>
            <Link href="/admin/settings" className={styles.btnAlt}>Open Settings</Link>
          </div>
        </div>
      </div>

      <div className="adminQuickLinks">
        <Link href="/admin/dashboard" className="adminBackBtn">Back to Dashboard</Link>
      </div>
    </div>
  );
}
