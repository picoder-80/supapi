import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Public: total active classifieds (hero stat). */
export async function GET() {
  try {
    const { count, error } = await supabase
      .from("classified_listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: { total: count ?? 0 } });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
