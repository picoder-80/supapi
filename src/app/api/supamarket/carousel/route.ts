import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const nowIso = new Date().toISOString();

    const { data: activeRows, error: activeErr } = await supabase
      .from("market_carousel_ads")
      .select("id, image_url, headline, cta_label, link_url, listing_id, expires_at")
      .eq("is_active", true)
      .gte("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(8);
    if (!activeErr) return NextResponse.json({ success: true, data: activeRows ?? [] });

    // Compatibility fallback for schema without is_active column.
    const { data, error } = await supabase
      .from("market_carousel_ads")
      .select("id, image_url, headline, cta_label, link_url, listing_id, expires_at")
      .gte("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: data ?? [] });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
