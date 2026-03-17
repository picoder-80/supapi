"use client";

import Link from "next/link";
import styles from "../page.module.css";

type Room = {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: string;
  entry_fee_pi: number;
  is_promoted: boolean;
  online_count: number;
};

export default function RoomList({ rooms }: { rooms: Room[] }) {
  return (
    <div className={styles.listWrap}>
      {rooms.map((r) => (
        <Link key={r.id} href={`/supachat/room/${r.id}`} className={styles.roomRow}>
          <div className={styles.roomTop}>
            <div className={styles.roomName}>
              {r.name}
              {r.is_promoted && <span className={styles.promotedBadge}>⭐ Promoted</span>}
            </div>
            <div className={styles.roomMeta}>
              {r.type === "paid" ? `π${r.entry_fee_pi}` : "FREE"}
            </div>
          </div>
          <div className={styles.roomDesc}>{r.description || "Public room"}</div>
          <div className={styles.roomBottom}>👥 {r.online_count || 0} online</div>
        </Link>
      ))}
    </div>
  );
}
