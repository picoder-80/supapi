"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import styles from "../../page.module.css";

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }

interface UserRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  kyc_status: string;
  bio: string | null;
}

export default function FollowingPage() {
  const params = useParams();
  const username = params.username as string;
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/supaspace/follow-list/${encodeURIComponent(username)}?type=following`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setUsers(d.data?.users ?? []);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [username]);

  if (notFound) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>👤</div>
          <div className={styles.emptyTitle}>User not found</div>
          <Link href="/supafeeds" className={styles.emptyBtn}>Back to SupaFeeds</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.followListHeader}>
        <Link href={`/supaspace/${username}`} className={styles.followListBack}>← Profile</Link>
        <h1 className={styles.followListTitle}>@{username} follows</h1>
        <p className={styles.followListSub}>{users.length} {users.length === 1 ? "account" : "accounts"}</p>
      </div>
      <div className={styles.body}>
        {loading ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>⏳</div>
            <div className={styles.emptyTitle}>Loading...</div>
          </div>
        ) : users.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>👥</div>
            <div className={styles.emptyTitle}>Not following anyone yet</div>
            <div className={styles.emptyDesc}>When @{username} follows people, they will appear here.</div>
            <Link href={`/supaspace/${username}`} className={styles.emptyBtn}>Back to Profile</Link>
          </div>
        ) : (
          <div className={styles.followListGrid}>
            {users.map((u) => (
              <Link key={u.id} href={`/supaspace/${u.username}`} className={styles.followListCard}>
                <div className={styles.followListCardTop}>
                  <div className={styles.followListAvatar}>
                    {u.avatar_url ? <img src={u.avatar_url} alt="" /> : <span>{getInitial(u.username)}</span>}
                  </div>
                  <div className={styles.followListInfo}>
                    <div className={styles.followListName}>
                      {u.display_name ?? u.username}
                      {u.kyc_status === "verified" && <span className={styles.kycBadge}>✅</span>}
                    </div>
                    <div className={styles.followListUsername}>@{u.username}</div>
                  </div>
                </div>
                {u.bio && <div className={styles.followListBio}>{u.bio}</div>}
                <span className={styles.followListView}>View Profile →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
