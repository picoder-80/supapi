// POST   /api/newsfeed/status/[id]/like — like
// DELETE /api/newsfeed/status/[id]/like — unlike

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const payload = auth ? verifyToken(auth) : null;
    if (!payload?.userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

    const supabase = await createAdminClient();

    const { data: post } = await supabase.from("status_posts").select("id").eq("id", id).single();
    if (!post) return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });

    const { error } = await supabase.from("status_post_likes").insert({ user_id: payload.userId, post_id: id });
    if (error?.code === "23505") return NextResponse.json({ success: true, data: { liked: true } }); // already liked
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const { data: row } = await supabase.from("status_posts").select("like_count").eq("id", id).single();
    const count = ((row as { like_count?: number })?.like_count ?? 0) + 1;
    await supabase.from("status_posts").update({ like_count: count }).eq("id", id);

    return NextResponse.json({ success: true, data: { liked: true } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const payload = auth ? verifyToken(auth) : null;
    if (!payload?.userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

    const supabase = await createAdminClient();
    const { error } = await supabase.from("status_post_likes").delete().eq("user_id", payload.userId).eq("post_id", id);
    if (error) return NextResponse.json({ success: false }, { status: 500 });

    const { data: row } = await supabase.from("status_posts").select("like_count").eq("id", id).single();
    const count = Math.max(0, ((row as { like_count?: number })?.like_count ?? 1) - 1);
    await supabase.from("status_posts").update({ like_count: count }).eq("id", id);

    return NextResponse.json({ success: true, data: { liked: false } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
