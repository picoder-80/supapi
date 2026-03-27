"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import LiveGiftPanel from "@/components/feed/LiveGiftPanel";
import LiveCardActions from "@/components/feed/LiveCardActions";
import styles from "./page.module.css";

function getInitial(u: string) { return u?.charAt(0).toUpperCase() ?? "?"; }

type PinnedProduct = {
  id: string;
  listing_id: string;
  position: number;
  listing: {
    id: string;
    title: string;
    price_pi: number;
    images: string[] | null;
    category: string;
  };
};

type LiveSession = {
  id: string;
  user_id: string;
  title: string | null;
  cf_playback_url: string | null;
  stream_url: string | null;
  status: string;
  viewer_count: number;
  like_count: number;
  comment_count: number;
  is_liked: boolean;
  user?: { username: string; display_name: string | null; avatar_url: string | null };
};

export default function WatchLivePage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pinnedProducts, setPinnedProducts] = useState<PinnedProduct[]>([]);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [showPinPanel, setShowPinPanel] = useState(false);
  const [pinning, setPinning] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "");
  const isHost = user && session && session.user_id === user.id;

  const fetchSession = async () => {
    if (!id) return;
    try {
      const r = await fetch(`/api/live/${id}`, {
        headers: user ? { Authorization: `Bearer ${token()}` } : {},
      });
      const d = await r.json();
      if (d.success && d.data) setSession(d.data);
      else setNotFound(true);
    } catch { setNotFound(true); }
  };

  const fetchPinnedProducts = async () => {
    if (!id) return;
    try {
      const r = await fetch(`/api/live/${id}/products`);
      const d = await r.json();
      if (d.success) setPinnedProducts(d.data.products ?? []);
    } catch {}
  };

  const fetchMyListings = async () => {
    if (!user || !token()) return;
    try {
      const r = await fetch("/api/supamarket?mine=1&limit=20", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (d.success) setMyListings(d.data?.listings ?? []);
    } catch {}
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([fetchSession(), fetchPinnedProducts()])
      .finally(() => setLoading(false));
  }, [id, user?.id]);

  // Poll products every 10s when live
  useEffect(() => {
    if (!id || !session || session.status !== "live") return;
    pollRef.current = setInterval(fetchPinnedProducts, 10_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [id, session?.status]);

  // Track view
  useEffect(() => {
    if (!id || !session || session.status !== "live") return;
    fetch(`/api/live/${id}/view`, { method: "POST" })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.viewer_count != null) {
          setSession(s => s ? { ...s, viewer_count: d.data.viewer_count } : s);
        }
      }).catch(() => {});
  }, [id, session?.id]);

  const pinProduct = async (listingId: string) => {
    setPinning(listingId);
    try {
      const r = await fetch(`/api/live/${id}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ listing_id: listingId }),
      });
      const d = await r.json();
      if (d.success) await fetchPinnedProducts();
      else alert(d.error ?? "Failed to pin product");
    } catch {}
    setPinning(null);
  };

  const unpinProduct = async (listingId: string) => {
    try {
      await fetch(`/api/live/${id}/products`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ listing_id: listingId }),
      });
      await fetchPinnedProducts();
    } catch {}
  };

  if (loading) return (
    <div className={styles.page}><div className={styles.loading}>Loading...</div></div>
  );

  if (notFound || !session) return (
    <div className={styles.page}>
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>🔴</div>
        <div className={styles.emptyTitle}>Live stream not found</div>
        <Link href="/live" className={styles.emptyBtn}>Back to Live</Link>
      </div>
    </div>
  );

  const playbackUrl = session.cf_playback_url || session.stream_url;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/live" className={styles.backBtn}>Back</Link>
        <h1 className={styles.title}>Live</h1>
      </div>

      <div className={styles.body}>
        {/* Video player */}
        <div className={styles.liveCard}>
          <div className={styles.liveVideoWrap}>
            {playbackUrl ? (
              <video
                src={playbackUrl}
                autoPlay
                playsInline
                muted
                controls
                className={styles.liveVideo}
              />
            ) : (
              <div className={styles.livePlaceholder}>
                <div className={styles.placeholderText}>
                  {session.status === "live" ? "Stream starting..." : "Stream ended"}
                </div>
              </div>
            )}
            {session.status === "live" && <span className={styles.liveBadge}>LIVE</span>}
            <span className={styles.liveViewerCount}>{session.viewer_count} watching</span>
            <div className={styles.liveHostBar}>
              <span className={styles.liveHostAvatar}>
                {session.user?.avatar_url
                  ? <img src={session.user.avatar_url} alt="" />
                  : getInitial(session.user?.username ?? "?")}
              </span>
              <Link href={`/supaspace/${session.user?.username ?? ""}`} className={styles.liveHostName}>
                @{session.user?.username ?? "?"}
              </Link>
            </div>
          </div>
          {session.title && <div className={styles.liveTitle}>{session.title}</div>}
        </div>

        {/* End live button for host */}
        {isHost && session.status === "live" && (
          <button
            className={styles.endLiveBtn}
            onClick={() => {
              fetch(`/api/live/${session.id}`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token()}` },
              }).then(r => r.json()).then(d => {
                if (d.success) setSession(s => s ? { ...s, status: "ended" } : s);
              });
            }}
          >
            End Live Session
          </button>
        )}

        {/* Pinned Products — TikTok Shop style */}
        {pinnedProducts.length > 0 && (
          <div className={styles.pinnedSection}>
            <div className={styles.pinnedTitle}>🛒 Shop from this Live</div>
            <div className={styles.pinnedList}>
              {pinnedProducts.map(p => (
                <div key={p.id} className={styles.pinnedCard}>
                  {p.listing.images?.[0] && (
                    <img src={p.listing.images[0]} alt={p.listing.title} className={styles.pinnedImg} />
                  )}
                  <div className={styles.pinnedInfo}>
                    <div className={styles.pinnedName}>{p.listing.title}</div>
                    <div className={styles.pinnedPrice}>{Number(p.listing.price_pi).toFixed(3)} Pi</div>
                  </div>
                  <Link
                    href={`/supamarket/${p.listing.id}`}
                    className={styles.pinnedBuyBtn}
                    target="_blank"
                  >
                    Buy
                  </Link>
                  {isHost && (
                    <button
                      className={styles.pinnedRemoveBtn}
                      onClick={() => unpinProduct(p.listing_id)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Host pin product panel */}
        {isHost && session.status === "live" && (
          <div className={styles.pinSection}>
            <button
              className={styles.pinToggleBtn}
              onClick={() => {
                setShowPinPanel(!showPinPanel);
                if (!showPinPanel) fetchMyListings();
              }}
            >
              {showPinPanel ? "Close" : "Pin Products from Supamarket"}
            </button>
            {showPinPanel && (
              <div className={styles.pinPanel}>
                <div className={styles.pinPanelTitle}>Your Listings</div>
                {myListings.length === 0 ? (
                  <div className={styles.pinEmpty}>No active listings found.</div>
                ) : (
                  <div className={styles.pinList}>
                    {myListings.map((l: any) => {
                      const isPinned = pinnedProducts.some(p => p.listing_id === l.id);
                      return (
                        <div key={l.id} className={styles.pinItem}>
                          <div className={styles.pinItemInfo}>
                            <div className={styles.pinItemName}>{l.title}</div>
                            <div className={styles.pinItemPrice}>{Number(l.price_pi).toFixed(3)} Pi</div>
                          </div>
                          {isPinned ? (
                            <button className={styles.pinnedTag} onClick={() => unpinProduct(l.id)}>
                              Pinned ✓
                            </button>
                          ) : (
                            <button
                              className={styles.pinItemBtn}
                              disabled={pinning === l.id}
                              onClick={() => pinProduct(l.id)}
                            >
                              {pinning === l.id ? "..." : "Pin"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Likes, comments */}
        {user && (
          <div style={{ padding: "0 0 16px" }}>
            <LiveCardActions
              sessionId={session.id}
              isEnded={session.status === "ended"}
              likeCount={session.like_count ?? 0}
              commentCount={session.comment_count ?? 0}
              isLiked={session.is_liked ?? false}
              onLike={() => setSession(s => s ? { ...s, is_liked: true, like_count: (s.like_count ?? 0) + 1 } : s)}
              onUnlike={() => setSession(s => s ? { ...s, is_liked: false, like_count: Math.max(0, (s.like_count ?? 1) - 1) } : s)}
              onRefresh={fetchSession}
              token={() => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "")}
            />
            <LiveGiftPanel
              sessionId={session.id}
              token={() => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
