"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import styles from "./page.module.css";

export default function AdminPodcastPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>🎙️ SupaPod</h1>
        <p className={styles.subtitle}>Podcast platform — browse, create, listen, tip with Pi</p>
      </div>
      <div className={styles.actions}>
        <Link href="/supapod" className={styles.link}>Browse Podcasts →</Link>
        <Link href="/supapod/create" className={styles.link}>Create Podcast →</Link>
      </div>
      <p className={styles.note}>Admin analytics and moderation coming soon.</p>
    </div>
  );
}
