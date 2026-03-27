// POST /api/reels/[id]/view — increment view count using SQL to avoid race condition

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

    // Use RPC to atomically increment — no race condition
    const { data, error } = await supabase.rpc("increment_reel_view", { reel_id: id });

    if (error) {
      // Fallback if RPC not available
      await supabase
        .from("reels")
        .update({ view_count: supabase.rpc("increment_reel_view", { reel_id: id }) as any })
        .eq("id", id);
    }

    const newCount = typeof data === "number" ? data : null;
    return NextResponse.json({ success: true, data: { view_count: newCount } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
