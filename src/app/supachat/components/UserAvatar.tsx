"use client";

import styles from "../page.module.css";

type UserAvatarProps = {
  username?: string | null;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  online?: boolean;
  verified?: boolean;
};

function getInitial(name?: string | null) {
  return (name ?? "?").charAt(0).toUpperCase();
}

export default function UserAvatar({
  username,
  avatarUrl,
  size = "md",
  online = false,
  verified = false,
}: UserAvatarProps) {
  return (
    <div className={`${styles.avatarWrap} ${size === "sm" ? styles.avatarSm : size === "lg" ? styles.avatarLg : styles.avatarMd}`}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={username ?? "user"} className={styles.avatarImg} />
      ) : (
        <div className={styles.avatarFallback}>{getInitial(username)}</div>
      )}
      {online && <span className={styles.onlineDot} />}
      {verified && <span className={styles.verifiedBadge}>✅</span>}
    </div>
  );
}
