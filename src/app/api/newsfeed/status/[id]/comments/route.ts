// GET  /api/newsfeed/status/[id]/comments — list comments
// POST /api/newsfeed/status/[id]/comments — add comment

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

    const supabase = await createAdminClient();
    const { data } = await supabase
      .from("feed_comments")
      .select(`
        id, body, created_at,
        user:users!user_id(id, username, display_name, avatar_url)
      `)
      .eq("target_type", "status")
      .eq("target_id", id)
      .order("created_at", { ascending: true });

    const comments = (data ?? []).map((c: any) => ({
      id: c.id,
      body: c.body,
      created_at: c.created_at,
      user: Array.isArray(c.user) ? c.user[0] : c.user,
    }));

    return NextResponse.json({ success: true, data: { comments } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

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

    const body = await req.json();
    const text = (body?.body ?? "").toString().trim();
    if (!text || text.length > 500) return NextResponse.json({ success: false, error: "Body required (max 500 chars)" }, { status: 400 });

    const supabase = await createAdminClient();

    const { data: post } = await supabase.from("status_posts").select("id").eq("id", id).single();
    if (!post) return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });

    const { data: comment, error } = await supabase
      .from("feed_comments")
      .insert({ target_type: "status", target_id: id, user_id: payload.userId, body: text })
      .select(`
        id, body, created_at,
        user:users!user_id(id, username, display_name, avatar_url)
      `)
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const c = comment as any;
    const out = {
      id: c.id,
      body: c.body,
      created_at: c.created_at,
      user: Array.isArray(c.user) ? c.user[0] : c.user,
    };

    const { data: row } = await supabase.from("status_posts").select("comment_count").eq("id", id).single();
    const count = ((row as { comment_count?: number })?.comment_count ?? 0) + 1;
    await supabase.from("status_posts").update({ comment_count: count }).eq("id", id);

    return NextResponse.json({ success: true, data: { comment: out } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
