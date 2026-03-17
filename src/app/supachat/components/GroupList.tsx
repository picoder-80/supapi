"use client";

import Link from "next/link";
import styles from "../page.module.css";

type Group = {
  id: string;
  name: string;
  description: string;
  member_count: number;
  creator?: { username?: string } | null;
};

export default function GroupList({ groups }: { groups: Group[] }) {
  return (
    <div className={styles.listWrap}>
      {groups.map((g) => (
        <Link key={g.id} href={`/supachat/group/${g.id}`} className={styles.roomRow}>
          <div className={styles.roomTop}>
            <div className={styles.roomName}>{g.name}</div>
            <div className={styles.roomMeta}>👥 {g.member_count}</div>
          </div>
          <div className={styles.roomDesc}>{g.description || `By @${g.creator?.username ?? "unknown"}`}</div>
        </Link>
      ))}
    </div>
  );
}
