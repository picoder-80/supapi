// POST   /api/reels/[id]/like — like
// DELETE /api/reels/[id]/like — unlike

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

    const { data: reel } = await supabase.from("reels").select("id").eq("id", id).single();
    if (!reel) return NextResponse.json({ success: false, error: "Reel not found" }, { status: 404 });

    const { error } = await supabase.from("reel_likes").insert({ user_id: payload.userId, reel_id: id });
    if (error?.code === "23505") return NextResponse.json({ success: true, data: { liked: true } });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const { data: row } = await supabase.from("reels").select("like_count").eq("id", id).single();
    const count = ((row as { like_count?: number })?.like_count ?? 0) + 1;
    await supabase.from("reels").update({ like_count: count }).eq("id", id);

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
    const { error } = await supabase.from("reel_likes").delete().eq("user_id", payload.userId).eq("reel_id", id);
    if (error) return NextResponse.json({ success: false }, { status: 500 });

    const { data: row } = await supabase.from("reels").select("like_count").eq("id", id).single();
    const count = Math.max(0, ((row as { like_count?: number })?.like_count ?? 1) - 1);
    await supabase.from("reels").update({ like_count: count }).eq("id", id);

    return NextResponse.json({ success: true, data: { liked: false } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
