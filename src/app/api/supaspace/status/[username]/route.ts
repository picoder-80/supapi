// GET — status posts by username (for profile Status tab)

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const supabase = await createAdminClient();

    const { data: profileUser } = await supabase.from("users").select("id").eq("username", username).single();
    if (!profileUser) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

    const { data: posts } = await supabase
      .from("status_posts")
      .select("id, user_id, body, created_at")
      .eq("user_id", profileUser.id)
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json({ success: true, data: { posts: posts ?? [] } });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
