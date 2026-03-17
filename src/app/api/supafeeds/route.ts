// GET /api/supafeeds — combined feed: status + reels + live from users you follow
// Requires auth. Returns items sorted by created_at/started_at descending.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

type FeedItem =
  | { type: "status"; id: string; user_id: string; body: string; created_at: string; like_count?: number; comment_count?: number; is_liked?: boolean; user?: { username: string; display_name: string | null; avatar_url: string | null } }
  | { type: "reel"; id: string; user_id: string; video_url: string; caption: string | null; like_count: number; view_count: number; comment_count: number; created_at: string; is_liked?: boolean; user?: { username: string; display_name: string | null; avatar_url: string | null } }
  | { type: "live"; id: string; user_id: string; title: string | null; stream_url: string | null; viewer_count: number; started_at: string; user?: { username: string; display_name: string | null; avatar_url: string | null } };

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
    const payload = token ? verifyToken(token) : null;
    const userId = payload?.userId ?? null;

    if (!userId) {
      return NextResponse.json({ success: false, error: "Sign in to see your feed" }, { status: 401 });
    }

    const supabase = await createAdminClient();

    let followingIds: string[] = [];
    try {
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);
      followingIds = (follows ?? []).map((f: { following_id: string }) => f.following_id);
    } catch {
      // follows table may not exist
    }

    const authorIds = [userId, ...followingIds];
    const items: { item: FeedItem; sortAt: string }[] = [];

    // Status posts
    const { data: statusPosts } = await supabase
      .from("status_posts")
      .select(`
        id, user_id, body, created_at, like_count, comment_count,
        user:users!user_id(id, username, display_name, avatar_url)
      `)
      .in("user_id", authorIds)
      .order("created_at", { ascending: false })
      .limit(30);

    const statusIds = (statusPosts ?? []).map((p: any) => p.id);
    let statusLikedSet = new Set<string>();
    if (statusIds.length > 0) {
      try {
        const { data: likes } = await supabase.from("status_post_likes").select("post_id").eq("user_id", userId).in("post_id", statusIds);
        statusLikedSet = new Set((likes ?? []).map((l: any) => l.post_id));
      } catch {}
    }

    for (const p of statusPosts ?? []) {
      const user = Array.isArray((p as any).user) ? (p as any).user[0] : (p as any).user;
      items.push({
        sortAt: p.created_at,
        item: {
          type: "status",
          id: p.id,
          user_id: p.user_id,
          body: p.body,
          created_at: p.created_at,
          like_count: p.like_count ?? 0,
          comment_count: p.comment_count ?? 0,
          is_liked: statusLikedSet.has(p.id),
          user,
        },
      });
    }

    // Reels
    const { data: reels } = await supabase
      .from("reels")
      .select(`
        id, user_id, video_url, caption, like_count, view_count, comment_count, created_at,
        user:users!user_id(id, username, display_name, avatar_url)
      `)
      .in("user_id", authorIds)
      .order("created_at", { ascending: false })
      .limit(30);

    const reelIds = (reels ?? []).map((r: any) => r.id);
    let reelLikedSet = new Set<string>();
    if (reelIds.length > 0) {
      try {
        const { data: likes } = await supabase.from("reel_likes").select("reel_id").eq("user_id", userId).in("reel_id", reelIds);
        reelLikedSet = new Set((likes ?? []).map((l: any) => l.reel_id));
      } catch {}
    }

    for (const r of reels ?? []) {
      const user = Array.isArray((r as any).user) ? (r as any).user[0] : (r as any).user;
      items.push({
        sortAt: r.created_at,
        item: {
          type: "reel",
          id: r.id,
          user_id: r.user_id,
          video_url: r.video_url,
          caption: r.caption,
          like_count: r.like_count ?? 0,
          view_count: r.view_count ?? 0,
          comment_count: r.comment_count ?? 0,
          created_at: r.created_at,
          is_liked: reelLikedSet.has(r.id),
          user,
        },
      });
    }

    // Live sessions (live only)
    const { data: liveSessions } = await supabase
      .from("live_sessions")
      .select(`
        id, user_id, title, stream_url, viewer_count, started_at,
        user:users!user_id(id, username, display_name, avatar_url)
      `)
      .in("user_id", authorIds)
      .eq("status", "live")
      .order("started_at", { ascending: false })
      .limit(20);

    for (const s of liveSessions ?? []) {
      const user = Array.isArray((s as any).user) ? (s as any).user[0] : (s as any).user;
      items.push({
        sortAt: s.started_at,
        item: {
          type: "live",
          id: s.id,
          user_id: s.user_id,
          title: s.title,
          stream_url: s.stream_url,
          viewer_count: s.viewer_count ?? 0,
          started_at: s.started_at,
          user,
        },
      });
    }

    // Sort by time descending
    items.sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());

    const feed = items.map(({ item }) => item);

    return NextResponse.json({ success: true, data: { feed } });
  } catch (err) {
    console.error("[SupaFeeds] GET error:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
