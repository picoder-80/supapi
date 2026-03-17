"use client";

import Link from "next/link";
import styles from "../dm/[conversationId]/page.module.css";

type MessageBubbleProps = {
  id?: string;
  own: boolean;
  content: string;
  type?: string;
  timestamp?: string;
  metadata?: Record<string, any> | null;
  onDelete?: (id: string) => void;
};

function formatTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const canDelete = (own: boolean, msgId?: string, del?: (id: string) => void, msgType?: string) =>
  own && msgId && del && !["system", "sponsored"].includes(msgType ?? "");

export default function MessageBubble({ id, own, content, type = "text", timestamp, metadata, onDelete }: MessageBubbleProps) {
  const cls = own ? styles.bubbleOwn : styles.bubbleOther;
  const showDelete = canDelete(own, id, onDelete, type);

  if (type === "pi_transfer") {
    return (
      <div className={`${styles.bubbleWrap} ${own ? styles.bubbleWrapOwn : styles.bubbleWrapOther}`}>
        <div className={`${styles.bubbleCard} ${cls}`}>
          <div className={styles.transferTitle}>💸 Pi Transfer</div>
          <div className={styles.transferAmount}>π{metadata?.net_pi ?? metadata?.gross_pi ?? "-"}</div>
          <div className={styles.transferMeta}>{content}</div>
          <div className={styles.bubbleTime}>{formatTime(timestamp)}</div>
        </div>
        {showDelete && (
          <button type="button" className={styles.msgDeleteBtn} onClick={() => onDelete!(id!)} aria-label="Padam mesej">
            🗑
          </button>
        )}
      </div>
    );
  }

  if (type === "listing_share") {
    const href = metadata?.href || "#";
    const coverImage = metadata?.image;
    return (
      <div className={`${styles.bubbleWrap} ${own ? styles.bubbleWrapOwn : styles.bubbleWrapOther}`}>
        <div className={`${styles.bubbleCard} ${cls} ${styles.listingShareCard}`}>
          {coverImage && (
            <Link href={href} className={styles.listingShareImgWrap}>
              <img src={coverImage} alt="" className={styles.listingShareImg} />
            </Link>
          )}
          <div className={styles.listingShareBody}>
            <div className={styles.listingShareTitle}>🛍️ Listing Shared</div>
            <div className={styles.listingShareText}>{content}</div>
            {metadata?.price_pi != null && (
              <div className={styles.listingSharePrice}>π{Number(metadata.price_pi).toFixed(2)}</div>
            )}
            <Link href={href} className={styles.listingShareBtn}>
              View
            </Link>
            <div className={styles.bubbleTime}>{formatTime(timestamp)}</div>
          </div>
        </div>
        {showDelete && (
          <button type="button" className={styles.msgDeleteBtn} onClick={() => onDelete!(id!)} aria-label="Padam mesej">
            🗑
          </button>
        )}
      </div>
    );
  }

  if (type === "system") {
    const dealId = metadata?.deal_id;
    if (dealId && metadata?.deal_intent) {
      return (
        <div className={styles.systemMessage}>
          {content.split("View Deal →")[0]}
          <Link href={`/supascrow?deal=${dealId}`} className={styles.dealLink}>
            View Deal →
          </Link>
        </div>
      );
    }
    return <div className={styles.systemMessage}>{content}</div>;
  }

  if (type === "sponsored") {
    return (
      <div className={styles.sponsoredCard}>
        <span className={styles.sponsoredPill}>Sponsored</span>
        <div className={styles.sponsoredText}>{content}</div>
      </div>
    );
  }

  return (
    <div className={`${styles.bubbleWrap} ${own ? styles.bubbleWrapOwn : styles.bubbleWrapOther}`}>
      <div className={`${styles.bubble} ${cls}`}>
        <div className={styles.bubbleText}>{content}</div>
        <div className={styles.bubbleTime}>{formatTime(timestamp)}</div>
      </div>
      {showDelete && (
        <button type="button" className={styles.msgDeleteBtn} onClick={() => onDelete!(id!)} aria-label="Padam mesej">
          🗑
        </button>
      )}
    </div>
  );
}
