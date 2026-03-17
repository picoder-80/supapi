"use client";

import Link from "next/link";
import styles from "../page.module.css";
import UserAvatar from "./UserAvatar";

type Conversation = {
  id: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  other_user: {
    id: string;
    username: string;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
};

export default function ConversationList({ conversations }: { conversations: Conversation[] }) {
  return (
    <div className={styles.listWrap}>
      {conversations.map((c) => (
        <Link key={c.id} href={`/supachat/dm/${c.id}`} className={styles.conversationRow}>
          <UserAvatar username={c.other_user?.username} avatarUrl={c.other_user?.avatar_url} verified={Boolean(c.other_user?.verified)} />
          <div className={styles.rowBody}>
            <div className={styles.rowTop}>
              <div className={styles.rowName}>{c.other_user?.display_name || `@${c.other_user?.username || "unknown"}`}</div>
              <div className={styles.rowTime}>{new Date(c.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
            <div className={styles.rowPreview}>{c.last_message || "No messages yet"}</div>
          </div>
          {c.unread_count > 0 && <span className={styles.unreadBadge}>{c.unread_count}</span>}
        </Link>
      ))}
    </div>
  );
}
