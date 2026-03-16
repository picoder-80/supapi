import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// GET /api/supaspace/follow-list/[username]?type=followers|following
// Returns list of users who follow this username (followers) or users this username follows (following)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // "followers" | "following"
    if (type !== "followers" && type !== "following") {
      return NextResponse.json({ success: false, error: "type must be followers or following" }, { status: 400 });
    }

    const supabase = await createAdminClient();
    const { data: profileUser } = await supabase.from("users").select("id").eq("username", username).single();
    if (!profileUser) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

    const uid = profileUser.id;
    let userIds: string[] = [];

    if (type === "followers") {
      const { data: rows } = await supabase.from("follows").select("follower_id").eq("following_id", uid);
      userIds = (rows ?? []).map((r: { follower_id: string }) => r.follower_id);
    } else {
      const { data: rows } = await supabase.from("follows").select("following_id").eq("follower_id", uid);
      userIds = (rows ?? []).map((r: { following_id: string }) => r.following_id);
    }

    if (userIds.length === 0) {
      return NextResponse.json({ success: true, data: { users: [] } });
    }

    const { data: users } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url, kyc_status, bio")
      .in("id", userIds);

    return NextResponse.json({ success: true, data: { users: users ?? [] } });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
