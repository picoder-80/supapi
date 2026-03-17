// GET /api/live/gifts — gift catalog for Live (TikTok-style)

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createAdminClient();
    const { data } = await supabase
      .from("live_gift_catalog")
      .select("id, name, emoji, amount_sc, sort_order")
      .order("sort_order", { ascending: true });

    return NextResponse.json({ success: true, data: { gifts: data ?? [] } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
