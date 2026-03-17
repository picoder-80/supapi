// POST /api/live/[id]/view — increment viewer count (called when user opens watch page)

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

    const supabase = await createAdminClient();
    const { data: session } = await supabase.from("live_sessions").select("id, viewer_count, status").eq("id", id).single();
    if (!session) return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    if ((session as { status?: string })?.status !== "live") return NextResponse.json({ success: false, error: "Session not live" }, { status: 400 });

    const count = ((session as { viewer_count?: number })?.viewer_count ?? 0) + 1;
    await supabase.from("live_sessions").update({ viewer_count: count }).eq("id", id);

    return NextResponse.json({ success: true, data: { viewer_count: count } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
