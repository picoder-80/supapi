// GET /api/newsfeed/status — feed of status posts from followed users
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
      // Get who user follows
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);
      const followingIds = (follows ?? []).map((f: { following_id: string }) => f.following_id);

      // Include own posts
      const authorIds = [userId, ...followingIds];

      const { data: posts } = await supabase
        .from("status_posts")
        .select("id")
        .in("user_id", authorIds)
        .order("created_at", { ascending: false })
        .limit(50);

      postIds = (posts ?? []).map((p: { id: string }) => p.id);
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
        user:users!user_id(id, username, display_name, avatar_url)
      `)
      .in("id", postIds)
      .order("created_at", { ascending: false });

    const withUser = (posts ?? []).map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      body: p.body,
      created_at: p.created_at,
      user: Array.isArray(p.user) ? p.user[0] : p.user,
    }));

    return NextResponse.json({ success: true, data: { posts: withUser } });
  } catch {
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
