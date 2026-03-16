import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

// GET — feed of reels from followed users + own
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
    const payload = token ? verifyToken(token) : null;
    const userId = payload?.userId ?? null;

    const supabase = await createAdminClient();

    let reelIds: string[] = [];

    if (userId) {
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);
      const followingIds = (follows ?? []).map((f: { following_id: string }) => f.following_id);
      const authorIds = [userId, ...followingIds];

      const { data: reels } = await supabase
        .from("reels")
        .select("id")
        .in("user_id", authorIds)
        .order("created_at", { ascending: false })
        .limit(50);

      reelIds = (reels ?? []).map((r: { id: string }) => r.id);
    } else {
      // Logged out: show popular/recent reels from anyone
      const { data: reels } = await supabase
        .from("reels")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(30);
      reelIds = (reels ?? []).map((r: { id: string }) => r.id);
    }

    if (reelIds.length === 0) {
      return NextResponse.json({ success: true, data: { reels: [] } });
    }

    const { data: reels } = await supabase
      .from("reels")
      .select(`
        id,
        user_id,
        video_url,
        caption,
        like_count,
        view_count,
        comment_count,
        created_at,
        user:users!user_id(id, username, display_name, avatar_url)
      `)
      .in("id", reelIds)
      .order("created_at", { ascending: false });

    const withUser = (reels ?? []).map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      video_url: r.video_url,
      caption: r.caption,
      like_count: r.like_count ?? 0,
      view_count: r.view_count ?? 0,
      comment_count: r.comment_count ?? 0,
      created_at: r.created_at,
      user: Array.isArray(r.user) ? r.user[0] : r.user,
    }));

    return NextResponse.json({ success: true, data: { reels: withUser } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const { video_url, caption } = await req.json();
    if (!video_url?.trim()) return NextResponse.json({ success: false, error: "Video URL required" }, { status: 400 });

    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("reels")
      .insert({
        user_id: payload.userId,
        video_url: video_url.trim(),
        caption: caption?.trim() ?? "",
      })
      .select("id, video_url, caption, created_at")
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: { reel: data } });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
