// POST   /api/live/[id]/like — like live session
// DELETE /api/live/[id]/like — unlike

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

    const { data: session } = await supabase.from("live_sessions").select("id").eq("id", id).single();
    if (!session) return NextResponse.json({ success: false, error: "Live session not found" }, { status: 404 });

    const { error } = await supabase.from("live_session_likes").insert({ user_id: payload.userId, live_session_id: id });
    if (error?.code === "23505") return NextResponse.json({ success: true, data: { liked: true } });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const { data: row } = await supabase.from("live_sessions").select("like_count").eq("id", id).single();
    const count = ((row as { like_count?: number })?.like_count ?? 0) + 1;
    await supabase.from("live_sessions").update({ like_count: count }).eq("id", id);

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
    const { error } = await supabase.from("live_session_likes").delete().eq("user_id", payload.userId).eq("live_session_id", id);
    if (error) return NextResponse.json({ success: false }, { status: 500 });

    const { data: row } = await supabase.from("live_sessions").select("like_count").eq("id", id).single();
    const count = Math.max(0, ((row as { like_count?: number })?.like_count ?? 1) - 1);
    await supabase.from("live_sessions").update({ like_count: count }).eq("id", id);

    return NextResponse.json({ success: true, data: { liked: false } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
