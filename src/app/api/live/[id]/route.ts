// GET  /api/live/[id] — get a single live session
// PATCH /api/live/[id] — end session (host only)

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ success: false }, { status: 400 });

    const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const payload = auth ? verifyToken(auth) : null;
    const userId = payload?.userId ?? null;

    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("live_sessions")
      .select(`
        id,
        user_id,
        title,
        stream_url,
        status,
        viewer_count,
        like_count,
        comment_count,
        started_at,
        user:users!user_id(id, username, display_name, avatar_url)
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false }, { status: 404 });
    }

    let isLiked = false;
    if (userId) {
      try {
        const { data: like } = await supabase
          .from("live_session_likes")
          .select("id")
          .eq("user_id", userId)
          .eq("live_session_id", id)
          .maybeSingle();
        isLiked = !!like;
      } catch {}
    }

    const session = {
      id: data.id,
      user_id: data.user_id,
      title: data.title,
      stream_url: data.stream_url,
      status: data.status,
      viewer_count: data.viewer_count ?? 0,
      like_count: data.like_count ?? 0,
      comment_count: data.comment_count ?? 0,
      is_liked: isLiked,
      started_at: data.started_at,
      user: Array.isArray(data.user) ? data.user[0] : data.user,
    };

    return NextResponse.json({ success: true, data: session });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function PATCH(
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
    const { data, error } = await supabase
      .from("live_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", payload.userId)
      .select("id, status, ended_at")
      .single();

    if (error || !data) return NextResponse.json({ success: false, error: "Not found or forbidden" }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
