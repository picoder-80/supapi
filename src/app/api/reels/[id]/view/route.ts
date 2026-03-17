// POST /api/reels/[id]/view — increment view count (called when video plays)

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
    const { data: reel } = await supabase.from("reels").select("id, view_count").eq("id", id).single();
    if (!reel) return NextResponse.json({ success: false, error: "Reel not found" }, { status: 404 });

    const count = ((reel as { view_count?: number })?.view_count ?? 0) + 1;
    await supabase.from("reels").update({ view_count: count }).eq("id", id);

    return NextResponse.json({ success: true, data: { view_count: count } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
