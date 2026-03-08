// GET /api/newsfeed?userId=xxx
// Returns posts from followed users (sorted by time) + popular posts (sorted by likes+shares)
// For now returns mock structure — ready for real posts table later

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    const supabase = await createAdminClient();

    // Get who user follows
    let followingIds: string[] = [];
    if (userId) {
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);
      followingIds = (follows ?? []).map((f: any) => f.following_id);
    }

    // Get popular pioneers (users with most followers — as proxy for popular content)
    const { data: popular } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url, kyc_status, bio")
      .not("id", "in", userId ? `(${[userId, ...followingIds].join(",")})` : `(${userId ?? "00000000-0000-0000-0000-000000000000"})`)
      .limit(6);

    // Get followed users profiles
    let following: any[] = [];
    if (followingIds.length > 0) {
      const { data } = await supabase
        .from("users")
        .select("id, username, display_name, avatar_url, kyc_status, bio")
        .in("id", followingIds)
        .limit(10);
      following = data ?? [];
    }

    return NextResponse.json({
      success: true,
      data: {
        following,
        popular: popular ?? [],
        has_posts: false, // Will be true when posts table exists
      }
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}