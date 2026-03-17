// GET /api/newsfeed/status — feed of status posts (followed + own, fallback to all)
// POST /api/newsfeed/status — create a status post

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
    const payload = token ? verifyToken(token) : null;
    const userId = payload?.userId ?? null;

    const supabase = await createAdminClient();

    let postIds: string[] = [];

    if (userId) {
      try {
        // Get who user follows
        const { data: follows } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", userId);
        const followingIds = (follows ?? []).map((f: { following_id: string }) => f.following_id);

        // Include own posts + followed users
        const authorIds = [userId, ...followingIds];

        const { data: posts } = await supabase
          .from("status_posts")
          .select("id")
          .in("user_id", authorIds)
          .order("created_at", { ascending: false })
          .limit(50);

        postIds = (posts ?? []).map((p: { id: string }) => p.id);
      } catch {
        // follows table may not exist — fall through to all posts
      }

      // Fallback: if no posts from followed/self, show all recent for discovery
      if (postIds.length === 0) {
        const { data: allPosts } = await supabase
          .from("status_posts")
          .select("id")
          .order("created_at", { ascending: false })
          .limit(50);
        postIds = (allPosts ?? []).map((p: { id: string }) => p.id);
      }
    }

    if (postIds.length === 0) {
      return NextResponse.json({ success: true, data: { posts: [] } });
    }

    const { data: posts } = await supabase
      .from("status_posts")
      .select(`
        id,
        user_id,
        body,
        created_at,
        like_count,
        comment_count,
        user:users!user_id(id, username, display_name, avatar_url)
      `)
      .in("id", postIds)
      .order("created_at", { ascending: false });

    let withUser = (posts ?? []).map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      body: p.body,
      created_at: p.created_at,
      like_count: p.like_count ?? 0,
      comment_count: p.comment_count ?? 0,
      user: Array.isArray(p.user) ? p.user[0] : p.user,
    }));

    if (userId && withUser.length > 0) {
      try {
        const { data: likes } = await supabase
          .from("status_post_likes")
          .select("post_id")
          .eq("user_id", userId)
          .in("post_id", withUser.map((p: any) => p.id));
        const likedSet = new Set((likes ?? []).map((l: any) => l.post_id));
        withUser = withUser.map((p: any) => ({ ...p, is_liked: likedSet.has(p.id) }));
      } catch {
        withUser = withUser.map((p: any) => ({ ...p, is_liked: false }));
      }
    } else {
      withUser = withUser.map((p: any) => ({ ...p, is_liked: false }));
    }

    return NextResponse.json({ success: true, data: { posts: withUser } });
  } catch (err) {
    console.error("[Newsfeed/status] GET error:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
    const payload = token ? verifyToken(token) : null;
    const userId = payload?.userId ?? null;

    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const text = (body?.body ?? "").toString().trim();
    if (!text || text.length > 500) {
      return NextResponse.json({ success: false, error: "Body required (max 500 chars)" }, { status: 400 });
    }

    const supabase = await createAdminClient();

    const { data, error } = await supabase
      .from("status_posts")
      .insert({ user_id: userId, body: text })
      .select("id, user_id, body, created_at")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
