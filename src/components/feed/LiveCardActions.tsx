"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./StatusCardActions.module.css";

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }

interface Props {
  sessionId: string;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  isEnded?: boolean;
  onLike: () => void;
  onUnlike: () => void;
  onRefresh: () => void;
  token: () => string;
}

export default function LiveCardActions({
  sessionId,
  likeCount,
  commentCount,
  isLiked,
  isEnded = false,
  onLike,
  onUnlike,
  onRefresh,
  token,
}: Props) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<{ id: string; body: string; created_at: string; user?: { username: string; avatar_url: string | null } }[]>([]);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const handleLike = async () => {
    if (isLiked) {
      await fetch(`/api/live/${sessionId}/like`, { method: "DELETE", headers: { Authorization: `Bearer ${token()}` } });
      onUnlike();
    } else {
      await fetch(`/api/live/${sessionId}/like`, { method: "POST", headers: { Authorization: `Bearer ${token()}` } });
      onLike();
    }
  };

  const loadComments = async () => {
    setShowComments(true);
    const r = await fetch(`/api/live/${sessionId}/comments`);
    const d = await r.json();
    if (d.success) setComments(d.data?.comments ?? []);
  };

  const postComment = async () => {
    const text = commentText.trim();
    if (!text || postingComment || isEnded) return;
    setPostingComment(true);
    const r = await fetch(`/api/live/${sessionId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ body: text }),
    });
    const d = await r.json();
    setPostingComment(false);
    if (d.success && d.data?.comment) {
      setCommentText("");
      setComments((prev) => [...prev, d.data.comment]);
      onRefresh();
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.actions}>
        <button type="button" className={styles.actionBtn} onClick={handleLike} disabled={isEnded} aria-label={isLiked ? "Unlike" : "Like"}>
          {isLiked ? "❤️" : "🤍"} {likeCount}
        </button>
        <button type="button" className={styles.actionBtn} onClick={loadComments}>
          💬 {commentCount}
        </button>
      </div>
      {showComments && (
        <div className={styles.commentsBox}>
          {comments.map((c) => (
            <div key={c.id || c.body} className={styles.comment}>
              <Link href={`/supaspace/${c.user?.username ?? ""}`} className={styles.commentAvatar}>
                {c.user?.avatar_url ? <img src={c.user.avatar_url} alt="" /> : getInitial(c.user?.username ?? "?")}
              </Link>
              <div className={styles.commentContent}>
                <Link href={`/supaspace/${c.user?.username ?? ""}`} className={styles.commentUser}>@{c.user?.username ?? "?"}</Link>
                <span className={styles.commentBody}>{c.body}</span>
              </div>
            </div>
          ))}
          <div className={styles.commentForm}>
            <input type="text" placeholder="Add a comment..." value={commentText} onChange={(e) => setCommentText(e.target.value)} maxLength={500} className={styles.commentInput} />
            <button type="button" onClick={postComment} disabled={postingComment || !commentText.trim()}>Post</button>
          </div>
        </div>
      )}
    </div>
  );
}
