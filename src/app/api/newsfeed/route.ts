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

    // Get who user follows (follows table may not exist yet)
    let followingIds: string[] = [];
    if (userId) {
      try {
        const { data: follows } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", userId);
        followingIds = (follows ?? []).map((f: { following_id: string }) => f.following_id);
      } catch {
        // follows table may not exist — continue with empty
      }
    }

    // Get popular pioneers (other users, limit 6)
    const excludeIds = userId ? [userId, ...followingIds] : [];
    let popular: { id: string; username: string; display_name: string | null; avatar_url: string | null; kyc_status: string; bio: string | null }[] = [];
    if (excludeIds.length > 0) {
      const { data } = await supabase
        .from("users")
        .select("id, username, display_name, avatar_url, kyc_status, bio")
        .not("id", "in", `(${excludeIds.join(",")})`)
        .limit(6);
      popular = data ?? [];
    } else {
      const { data } = await supabase
        .from("users")
        .select("id, username, display_name, avatar_url, kyc_status, bio")
        .limit(6);
      popular = data ?? [];
    }

    // Get followed users profiles
    let following: { id: string; username: string; display_name: string | null; avatar_url: string | null; kyc_status: string; bio: string | null }[] = [];
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
        popular,
        has_posts: false, // Will be true when posts table exists
      }
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}