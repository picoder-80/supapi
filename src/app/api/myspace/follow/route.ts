import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

// POST — follow a user  { username }
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const { username } = await req.json();
    const supabase = await createAdminClient();

    const { data: target } = await supabase.from("users").select("id").eq("username", username).single();
    if (!target) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    if (target.id === payload.userId) return NextResponse.json({ success: false, error: "Cannot follow yourself" }, { status: 400 });

    const { error } = await supabase.from("follows").insert({ follower_id: payload.userId, following_id: target.id });
    if (error && error.code !== "23505") return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, data: { following: true } });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

// DELETE — unfollow  { username }
export async function DELETE(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const { username } = await req.json();
    const supabase = await createAdminClient();

    const { data: target } = await supabase.from("users").select("id").eq("username", username).single();
    if (!target) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

    await supabase.from("follows").delete().eq("follower_id", payload.userId).eq("following_id", target.id);
    return NextResponse.json({ success: true, data: { following: false } });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}