// GET — feed of live sessions from followed users + own
// POST — start a live session

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

    let sessionIds: string[] = [];

    if (userId) {
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);
      const followingIds = (follows ?? []).map((f: { following_id: string }) => f.following_id);
      const authorIds = [userId, ...followingIds];

      const { data: sessions } = await supabase
        .from("live_sessions")
        .select("id")
        .in("user_id", authorIds)
        .eq("status", "live")
        .order("started_at", { ascending: false })
        .limit(50);

      sessionIds = (sessions ?? []).map((s: { id: string }) => s.id);
    } else {
      const { data: sessions } = await supabase
        .from("live_sessions")
        .select("id")
        .eq("status", "live")
        .order("started_at", { ascending: false })
        .limit(30);
      sessionIds = (sessions ?? []).map((s: { id: string }) => s.id);
    }

    if (sessionIds.length === 0) {
      return NextResponse.json({ success: true, data: { sessions: [] } });
    }

    const { data: sessions } = await supabase
      .from("live_sessions")
      .select(`
        id,
        user_id,
        title,
        stream_url,
        status,
        viewer_count,
        started_at,
        user:users!user_id(id, username, display_name, avatar_url)
      `)
      .in("id", sessionIds)
      .order("started_at", { ascending: false });

    const withUser = (sessions ?? []).map((s: any) => ({
      id: s.id,
      user_id: s.user_id,
      title: s.title,
      stream_url: s.stream_url,
      status: s.status,
      viewer_count: s.viewer_count ?? 0,
      started_at: s.started_at,
      user: Array.isArray(s.user) ? s.user[0] : s.user,
    }));

    return NextResponse.json({ success: true, data: { sessions: withUser } });
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

    const body = await req.json().catch(() => ({}));
    const title = (body?.title ?? "").toString().trim();

    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("live_sessions")
      .insert({
        user_id: payload.userId,
        title: title || null,
        status: "live",
      })
      .select("id, user_id, title, status, viewer_count, started_at")
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
