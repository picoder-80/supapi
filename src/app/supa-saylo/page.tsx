"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import KycBadge from "@/components/ui/KycBadge";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

interface Post {
  id: string; user_id: string; content: string; type: string;
  images: string[]; link_url: string; poll_options: string[];
  poll_ends_at: string | null; poll_votes: number[]; voted: number | null;
  parent_id: string | null; quote_id: string | null; quoted_post: any;
  like_count: number; resaylo_count: number; reply_count: number;
  quote_count: number; view_count: number;
  liked: boolean; "resaylo_d": boolean;
  created_at: string;
}
interface User {
  id: string; username: string; display_name: string | null;
  avatar_url: string | null; kyc_status: string;
}
interface Trending { tag: string; post_count: number; }

const TABS = [
  { id: "latest",   label: "✨ Latest"   },
  { id: "trending", label: "🔥 Trending" },
  { id: "takes",    label: "π Pi Takes"  },
];

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function getInitial(u: string) { return (u ?? "?").charAt(0).toUpperCase(); }

function linkifyContent(text: string) {
  return text
    .replace(/#([\w]+)/g, `<span class="hashLink">#$1</span>`)
    .replace(/@([\w]+)/g, `<span class="mentionLink">@$1</span>`);
}

export default function SupaSayloPage() {
  const { user } = useAuth();
  const router   = useRouter();
  const token    = () => typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "";
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const [posts, setPosts]       = useState<Post[]>([]);
  const [users, setUsers]       = useState<Record<string, User>>({});
  const [trending, setTrending] = useState<Trending[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState("latest");
  const [toast, setToast]       = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Inline composer
  const [composing, setComposing] = useState(false);
  const [draft, setDraft]         = useState("");
  const [draftType, setDraftType] = useState<"saylo" | "take">("saylo");
  const [posting, setPosting]     = useState(false);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/supa-saylo?tab=${tab}`, {
        headers: user ? { Authorization: `Bearer ${token()}` } : {},
      });
      const d = await r.json();
      if (d.success) {
        setPosts(d.data.posts);
        setUsers(d.data.users);
        setTrending(d.data.trending ?? []);
      }
    } catch {}
    setLoading(false);
  }, [tab, user?.id]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handlePost = async () => {
    if (!draft.trim() || posting) return;
    if (!user) { router.push("/dashboard"); return; }
    setPosting(true);
    try {
      const r = await fetch("/api/supa-saylo", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ content: draft, type: draftType }),
      });
      const d = await r.json();
      if (d.success) {
        setDraft(""); setComposing(false);
        showToast(draftType === "take" ? "π Pi Take dropped!" : "✨ Saylo posted!");
        fetchPosts();
      } else showToast(d.error ?? "Failed to post", "error");
    } catch { showToast("Something went wrong", "error"); }
    setPosting(false);
  };

  const handleLike = async (post: Post, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { router.push("/dashboard"); return; }
    setPosts(prev => prev.map(p => p.id === post.id
      ? { ...p, liked: !p.liked, like_count: p.liked ? p.like_count - 1 : p.like_count + 1 }
      : p
    ));
    await fetch(`/api/supa-saylo/${post.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ action: "like" }),
    });
  };

  const handleResaylo = async (post: Post, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { router.push("/dashboard"); return; }
    setPosts(prev => prev.map(p => p.id === post.id
      ? { ...p, "resaylo'd": !p["resaylo_d"], resaylo_count: p["resaylo_d"] ? p.resaylo_count - 1 : p.resaylo_count + 1 }
      : p
    ));
    const r = await fetch(`/api/supa-saylo/${post.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ action: "resaylo" }),
    });
    const d = await r.json();
    if (d.data?.resaylo) showToast("🔁 Resaylo'd!");
  };

  const handleVote = async (post: Post, idx: number) => {
    if (!user) { router.push("/dashboard"); return; }
    if (post.voted !== null) return;
    const r = await fetch(`/api/supa-saylo/${post.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ action: "vote", option_index: idx }),
    });
    const d = await r.json();
    if (d.success) {
      setPosts(prev => prev.map(p => p.id === post.id
        ? { ...p, voted: idx, poll_votes: d.data.poll_votes }
        : p
      ));
    }
  };

  const charCount = draft.length;
  const charLeft  = 500 - charCount;

  return (
    <div className={styles.page}>

      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>
          {toast.msg}
        </div>
      )}

      <div className={styles.layout}>

        {/* ── Main Column ── */}
        <div className={styles.main}>

          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerTop}>
              <div>
                <h1 className={styles.brand}>🧵 SupaSaylo</h1>
                <p className={styles.brandSub}>Pi Conversations & Threads</p>
              </div>
              <button
                className={styles.newPostBtn}
                onClick={() => user ? setComposing(true) : router.push("/dashboard")}
              >
                + Saylo
              </button>
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
              {TABS.map(t => (
                <button
                  key={t.id}
                  className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Inline Composer */}
          {composing && (
            <div className={styles.composer}>
              <div className={styles.composerTop}>
                {user && (
                  <div className={styles.composerAvatar}>
                    {user.avatar_url
                      ? <img src={user.avatar_url} alt="" className={styles.composerAvatarImg} />
                      : <span className={styles.composerAvatarInitial}>{getInitial(user.username)}</span>
                    }
                  </div>
                )}
                <div className={styles.composerRight}>
                  <div className={styles.typeRow}>
                    <button
                      className={`${styles.typeBtn} ${draftType === "saylo" ? styles.typeBtnActive : ""}`}
                      onClick={() => setDraftType("saylo")}
                    >✨ Saylo</button>
                    <button
                      className={`${styles.typeBtn} ${draftType === "take" ? styles.typeBtnTake : ""}`}
                      onClick={() => setDraftType("take")}
                    >π Pi Take</button>
                  </div>
                  <textarea
                    ref={composerRef}
                    className={`${styles.composerTextarea} ${draftType === "take" ? styles.composerTextareaTake : ""}`}
                    placeholder={draftType === "take"
                      ? "Share your Pi prediction or opinion..."
                      : "What's on your mind, Pioneer?"}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    maxLength={500}
                    autoFocus
                    rows={3}
                  />
                  <div className={styles.composerFooter}>
                    <span className={`${styles.charCounter} ${charLeft < 50 ? styles.charCounterWarn : ""}`}>
                      {charLeft}
                    </span>
                    <div className={styles.composerActions}>
                      <button className={styles.cancelBtn} onClick={() => { setComposing(false); setDraft(""); }}>
                        Cancel
                      </button>
                      <button
                        className={`${styles.postBtn} ${draftType === "take" ? styles.postBtnTake : ""}`}
                        onClick={handlePost}
                        disabled={posting || !draft.trim()}
                      >
                        {posting ? "Posting..." : draftType === "take" ? "Drop π Take" : "Post Saylo"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Feed */}
          <div className={styles.feed}>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className={styles.skeleton} style={{ animationDelay: `${i * 0.06}s` }} />
              ))
            ) : posts.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🧵</div>
                <div className={styles.emptyTitle}>No Saylos yet</div>
                <div className={styles.emptyDesc}>Be the first to say something!</div>
                <button className={styles.emptyBtn}
                  onClick={() => user ? setComposing(true) : router.push("/dashboard")}>
                  + Post First Saylo
                </button>
              </div>
            ) : (
              posts.map((post, i) => {
                const author = users[post.user_id];
                if (!author) return null;
                const isTake = post.type === "take";
                const totalPollVotes = (post.poll_votes ?? []).reduce((a, b) => a + (b ?? 0), 0);
                return (
                  <div
                    key={post.id}
                    className={`${styles.postCard} ${isTake ? styles.postCardTake : ""}`}
                    style={{ animationDelay: `${i * 0.03}s` }}
                  >
                    {isTake && <div className={styles.takeBadge}>π Pi Take</div>}

                    <div className={styles.postTop}>
                      <Link href={`/supaspace/${author.username}`} className={styles.postAvatar}>
                        {author.avatar_url
                          ? <img src={author.avatar_url} alt={author.username} className={styles.postAvatarImg} />
                          : <span className={styles.postAvatarInitial}>{getInitial(author.username)}</span>
                        }
                      </Link>

                      <div className={styles.postRight}>
                        <div className={styles.postMeta}>
                          <Link href={`/supaspace/${author.username}`} className={styles.postAuthor}>
                            {author.display_name ?? author.username}
                            {author.kyc_status === "verified" && <span className={styles.kyc}><KycBadge size={14} /></span>}
                          </Link>
                          <span className={styles.postUsername}>@{author.username}</span>
                          <span className={styles.postDot}>·</span>
                          <span className={styles.postTime}>{timeAgo(post.created_at)}</span>
                        </div>

                        {/* Content */}
                        <div
                          className={styles.postContent}
                          dangerouslySetInnerHTML={{ __html: linkifyContent(post.content) }}
                        />

                        {/* Images */}
                        {post.images?.length > 0 && (
                          <div className={`${styles.postImages} ${post.images.length > 1 ? styles.postImagesGrid : ""}`}>
                            {post.images.slice(0, 4).map((img, idx) => (
                              <img key={idx} src={img} alt="" className={styles.postImage} />
                            ))}
                          </div>
                        )}

                        {/* Poll */}
                        {post.type === "poll" && post.poll_options?.length > 0 && (
                          <div className={styles.poll}>
                            {post.poll_options.map((opt, idx) => {
                              const votes = post.poll_votes?.[idx] ?? 0;
                              const pct   = totalPollVotes > 0 ? Math.round((votes / totalPollVotes) * 100) : 0;
                              const voted = post.voted === idx;
                              const shown = post.voted !== null;
                              return (
                                <button
                                  key={idx}
                                  className={`${styles.pollOption} ${voted ? styles.pollOptionVoted : ""} ${shown ? styles.pollOptionShown : ""}`}
                                  onClick={() => handleVote(post, idx)}
                                  disabled={post.voted !== null}
                                >
                                  {shown && <div className={styles.pollBar} style={{ width: `${pct}%` }} />}
                                  <span className={styles.pollLabel}>{opt}</span>
                                  {shown && <span className={styles.pollPct}>{pct}%</span>}
                                </button>
                              );
                            })}
                            <div className={styles.pollMeta}>
                              {totalPollVotes} votes
                              {post.poll_ends_at && ` · ends ${timeAgo(post.poll_ends_at)}`}
                            </div>
                          </div>
                        )}

                        {/* Quoted post */}
                        {post.quoted_post && (
                          <div className={styles.quoteBox}>
                            <div className={styles.quoteAuthor}>
                              @{post.quoted_post.author?.username ?? "unknown"}
                            </div>
                            <div className={styles.quoteContent}>
                              {post.quoted_post.content?.slice(0, 140)}
                              {post.quoted_post.content?.length > 140 && "..."}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className={styles.postActions}>
                          <button
                            className={`${styles.actionBtn} ${post.liked ? styles.actionLiked : ""}`}
                            onClick={e => handleLike(post, e)}
                          >
                            {post.liked ? "❤️" : "🤍"} <span>{post.like_count || ""}</span>
                          </button>
                          <button
                            className={`${styles.actionBtn} ${post["resaylo_d"] ? styles.actionResaylo : ""}`}
                            onClick={e => handleResaylo(post, e)}
                          >
                            🔁 <span>{post.resaylo_count || ""}</span>
                          </button>
                          <Link
                            href={`/supa-saylo/${post.id}`}
                            className={styles.actionBtn}
                            onClick={e => e.stopPropagation()}
                          >
                            💬 <span>{post.reply_count || ""}</span>
                          </Link>
                          <span className={styles.actionMuted}>
                            👁 {post.view_count}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Sidebar (desktop) ── */}
        <div className={styles.sidebar}>
          <div className={styles.sideCard}>
            <div className={styles.sideTitle}>🔥 Trending in Pi</div>
            {trending.length === 0 ? (
              <div className={styles.sideMuted}>No trending topics yet</div>
            ) : (
              trending.map((t, i) => (
                <div key={t.tag} className={styles.trendRow}>
                  <span className={styles.trendRank}>#{i + 1}</span>
                  <div>
                    <div className={styles.trendTag}>#{t.tag}</div>
                    <div className={styles.trendCount}>{t.post_count} Saylos</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className={styles.sideCard}>
            <div className={styles.sideTitle}>💎 SC Rewards</div>
            <div className={styles.rewardRow}><span>First Saylo</span><span className={styles.rewardSc}>+15 SC</span></div>
            <div className={styles.rewardRow}><span>10 likes on post</span><span className={styles.rewardSc}>+5 SC</span></div>
            <div className={styles.rewardRow}><span>Post resaylo'd</span><span className={styles.rewardSc}>+3 SC</span></div>
            <div className={styles.rewardRow}><span>Post trending</span><span className={styles.rewardSc}>+50 SC</span></div>
          </div>

          {!user && (
            <div className={styles.sideCard}>
              <div className={styles.sideTitle}>🪐 Join SupaSaylo</div>
              <p className={styles.sideMuted}>Sign in with Pi to post, like, and join the conversation.</p>
              <Link href="/dashboard" className={styles.sideSignIn}>Sign in with π Pi</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
