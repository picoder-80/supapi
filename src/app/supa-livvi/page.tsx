"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

const CATEGORIES = [
  { id: "all",       emoji: "✨", label: "All"       },
  { id: "food",      emoji: "🍜", label: "Food"      },
  { id: "travel",    emoji: "✈️", label: "Travel"    },
  { id: "fashion",   emoji: "👗", label: "Fashion"   },
  { id: "beauty",    emoji: "💄", label: "Beauty"    },
  { id: "fitness",   emoji: "💪", label: "Fitness"   },
  { id: "home",      emoji: "🏠", label: "Home"      },
  { id: "tech",      emoji: "📱", label: "Tech"      },
  { id: "lifestyle", emoji: "🌿", label: "Lifestyle" },
  { id: "finance",   emoji: "💰", label: "Finance"   },
  { id: "pi",        emoji: "π",  label: "Pi Life"   },
];

interface Post {
  id: string; user_id: string; caption: string; images: string[];
  category: string; hashtags: string[]; location: string;
  like_count: number; save_count: number; view_count: number;
  comment_count: number; created_at: string;
  liked: boolean; saved: boolean;
}
interface User {
  id: string; username: string; display_name: string | null;
  avatar_url: string | null; kyc_status: string;
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

function getInitial(s: string) { return (s ?? "?").charAt(0).toUpperCase(); }

export default function SupaLivviPage() {
  const { user } = useAuth();
  const router   = useRouter();
  const token    = () => typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "";

  const [posts, setPosts]     = useState<Post[]>([]);
  const [users, setUsers]     = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<"trending" | "latest">("trending");
  const [category, setCategory] = useState("all");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [toast, setToast]     = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [activeImg, setActiveImg] = useState<Record<string, number>>({});

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/supa-livvi?tab=${tab}&category=${category}`, {
        headers: user ? { Authorization: `Bearer ${token()}` } : {},
      });
      const d = await r.json();
      if (d.success) { setPosts(d.data.posts); setUsers(d.data.users); }
    } catch {}
    setLoading(false);
  }, [tab, category, user?.id]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleLike = async (post: Post, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { router.push("/dashboard"); return; }
    // Optimistic update
    setPosts(prev => prev.map(p => p.id === post.id
      ? { ...p, liked: !p.liked, like_count: p.liked ? p.like_count - 1 : p.like_count + 1 }
      : p
    ));
    await fetch(`/api/supa-livvi/${post.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ action: "like" }),
    });
  };

  const handleSave = async (post: Post, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { router.push("/dashboard"); return; }
    setPosts(prev => prev.map(p => p.id === post.id
      ? { ...p, saved: !p.saved, save_count: p.saved ? p.save_count - 1 : p.save_count + 1 }
      : p
    ));
    await fetch(`/api/supa-livvi/${post.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ action: "save" }),
    });
    if (!post.saved) showToast("✨ Saved to collection!");
  };

  const nextImg = (postId: string, total: number, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setActiveImg(prev => ({ ...prev, [postId]: ((prev[postId] ?? 0) + 1) % total }));
  };

  const prevImg = (postId: string, total: number, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setActiveImg(prev => ({ ...prev, [postId]: ((prev[postId] ?? 0) - 1 + total) % total }));
  };

  return (
    <div className={styles.page}>

      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brandRow}>
            <div>
              <h1 className={styles.brandName}>✨ SupaLivvi</h1>
              <p className={styles.brandTagline}>Pi Lifestyle & Discovery</p>
            </div>
            <Link href="/supa-livvi/create" className={styles.createBtn}>
              + Post
            </Link>
          </div>

          {/* Category pills */}
          <div className={styles.catScroll}>
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                className={`${styles.catPill} ${category === c.id ? styles.catPillActive : ""}`}
                onClick={() => setCategory(c.id)}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>

          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === "trending" ? styles.tabActive : ""}`}
              onClick={() => setTab("trending")}
            >
              🔥 Trending
            </button>
            <button
              className={`${styles.tab} ${tab === "latest" ? styles.tabActive : ""}`}
              onClick={() => setTab("latest")}
            >
              🆕 Latest
            </button>
          </div>
        </div>
      </div>

      {/* ── Feed ── */}
      <div className={styles.feed}>
        {loading ? (
          <div className={styles.grid}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className={styles.skeleton} style={{ animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIllustration}>✨</div>
            <div className={styles.emptyTitle}>No posts yet in this category</div>
            <div className={styles.emptyDesc}>Be the first to share your lifestyle!</div>
            <Link href="/supa-livvi/create" className={styles.emptyBtn}>+ Create First Post</Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {posts.map((post, i) => {
              const author    = users[post.user_id];
              const imgIndex  = activeImg[post.id] ?? 0;
              const hasMulti  = post.images.length > 1;
              return (
                <div
                  key={post.id}
                  className={styles.card}
                  style={{ animationDelay: `${i * 0.04}s` }}
                  onClick={() => setSelectedPost(post)}
                >
                  {/* Image */}
                  <div className={styles.cardImgWrap}>
                    {post.images[imgIndex] ? (
                      <img
                        src={post.images[imgIndex]}
                        alt={post.caption}
                        className={styles.cardImg}
                      />
                    ) : (
                      <div className={styles.cardImgPlaceholder}>
                        {CATEGORIES.find(c => c.id === post.category)?.emoji ?? "✨"}
                      </div>
                    )}

                    {/* Multi-image nav */}
                    {hasMulti && (
                      <>
                        <button className={styles.imgPrev} onClick={e => prevImg(post.id, post.images.length, e)}>‹</button>
                        <button className={styles.imgNext} onClick={e => nextImg(post.id, post.images.length, e)}>›</button>
                        <div className={styles.imgDots}>
                          {post.images.map((_, idx) => (
                            <span key={idx} className={`${styles.imgDot} ${idx === imgIndex ? styles.imgDotActive : ""}`} />
                          ))}
                        </div>
                      </>
                    )}

                    {/* Category badge */}
                    <div className={styles.catBadge}>
                      {CATEGORIES.find(c => c.id === post.category)?.emoji} {post.category}
                    </div>

                    {/* Multi-image count */}
                    {hasMulti && (
                      <div className={styles.multiCount}>
                        {imgIndex + 1}/{post.images.length}
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div className={styles.cardBody}>
                    {/* Author */}
                    {author && (
                      <div className={styles.cardAuthor}>
                        <div className={styles.authorAvatar}>
                          {author.avatar_url
                            ? <img src={author.avatar_url} alt={author.username} className={styles.authorAvatarImg} />
                            : <span className={styles.authorAvatarInitial}>{getInitial(author.username)}</span>
                          }
                        </div>
                        <div className={styles.authorInfo}>
                          <span className={styles.authorName}>
                            {author.display_name ?? author.username}
                            {author.kyc_status === "verified" && <span className={styles.kycBadge}> ✅</span>}
                          </span>
                          <span className={styles.authorMeta}>
                            {post.location && `📍 ${post.location} · `}{timeAgo(post.created_at)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Caption */}
                    {post.caption && (
                      <p className={styles.cardCaption}>{post.caption}</p>
                    )}

                    {/* Hashtags */}
                    {post.hashtags?.length > 0 && (
                      <div className={styles.hashtags}>
                        {post.hashtags.slice(0, 4).map(h => (
                          <span key={h} className={styles.hashtag}>#{h}</span>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className={styles.cardActions}>
                      <button
                        className={`${styles.actionBtn} ${post.liked ? styles.actionLiked : ""}`}
                        onClick={e => handleLike(post, e)}
                      >
                        {post.liked ? "❤️" : "🤍"} {post.like_count > 0 ? post.like_count : ""}
                      </button>
                      <button
                        className={`${styles.actionBtn} ${post.saved ? styles.actionSaved : ""}`}
                        onClick={e => handleSave(post, e)}
                      >
                        {post.saved ? "🔖" : "📌"} {post.save_count > 0 ? post.save_count : ""}
                      </button>
                      <span className={styles.actionMuted}>
                        💬 {post.comment_count}
                      </span>
                      <span className={styles.actionMuted} style={{ marginLeft: "auto" }}>
                        👁 {post.view_count}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Post Detail Modal ── */}
      {selectedPost && (() => {
        const author   = users[selectedPost.user_id];
        const imgIndex = activeImg[selectedPost.id] ?? 0;
        return (
          <div className={styles.modal}>
            <div className={styles.modalBackdrop} onClick={() => setSelectedPost(null)} />
            <div className={styles.modalSheet}>
              <div className={styles.modalHandle} />

              {/* Image carousel */}
              <div className={styles.modalImgWrap}>
                {selectedPost.images[imgIndex] ? (
                  <img src={selectedPost.images[imgIndex]} alt="" className={styles.modalImg} />
                ) : (
                  <div className={styles.modalImgPlaceholder}>
                    {CATEGORIES.find(c => c.id === selectedPost.category)?.emoji ?? "✨"}
                  </div>
                )}
                {selectedPost.images.length > 1 && (
                  <>
                    <button className={styles.imgPrev} onClick={e => prevImg(selectedPost.id, selectedPost.images.length, e)}>‹</button>
                    <button className={styles.imgNext} onClick={e => nextImg(selectedPost.id, selectedPost.images.length, e)}>›</button>
                    <div className={styles.imgDots}>
                      {selectedPost.images.map((_, idx) => (
                        <span key={idx} className={`${styles.imgDot} ${idx === imgIndex ? styles.imgDotActive : ""}`} />
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className={styles.modalBody}>
                {author && (
                  <div className={styles.cardAuthor} style={{ marginBottom: 12 }}>
                    <div className={styles.authorAvatar}>
                      {author.avatar_url
                        ? <img src={author.avatar_url} alt={author.username} className={styles.authorAvatarImg} />
                        : <span className={styles.authorAvatarInitial}>{getInitial(author.username)}</span>
                      }
                    </div>
                    <div className={styles.authorInfo}>
                      <span className={styles.authorName}>
                        {author.display_name ?? author.username}
                        {author.kyc_status === "verified" && <span className={styles.kycBadge}> ✅</span>}
                      </span>
                      <span className={styles.authorMeta}>{timeAgo(selectedPost.created_at)}</span>
                    </div>
                    <Link
                      href={`/supaspace/${author.username}`}
                      className={styles.viewProfileLink}
                      onClick={e => e.stopPropagation()}
                    >
                      View Profile →
                    </Link>
                  </div>
                )}

                {selectedPost.caption && (
                  <p className={styles.modalCaption}>{selectedPost.caption}</p>
                )}

                {selectedPost.hashtags?.length > 0 && (
                  <div className={styles.hashtags} style={{ marginBottom: 16 }}>
                    {selectedPost.hashtags.map(h => (
                      <span key={h} className={styles.hashtag}>#{h}</span>
                    ))}
                  </div>
                )}

                {selectedPost.location && (
                  <div className={styles.modalLocation}>📍 {selectedPost.location}</div>
                )}

                <div className={styles.modalActions}>
                  <button
                    className={`${styles.modalActionBtn} ${selectedPost.liked ? styles.actionLiked : ""}`}
                    onClick={e => handleLike(selectedPost, e)}
                  >
                    {selectedPost.liked ? "❤️" : "🤍"} {selectedPost.like_count} Likes
                  </button>
                  <button
                    className={`${styles.modalActionBtn} ${selectedPost.saved ? styles.actionSaved : ""}`}
                    onClick={e => handleSave(selectedPost, e)}
                  >
                    {selectedPost.saved ? "🔖 Saved" : "📌 Save"}
                  </button>
                </div>

                <button className={styles.modalCloseBtn} onClick={() => setSelectedPost(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
