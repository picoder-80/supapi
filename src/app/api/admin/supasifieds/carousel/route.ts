import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "@/lib/admin-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req.headers.get("authorization"));
  if (!admin.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const status = (new URL(req.url).searchParams.get("status") ?? "all").toLowerCase();
  try {
    let query = supabase
      .from("classified_carousel_ads")
      .select(
        "id, headline, image_url, cta_label, link_url, sc_cost, starts_at, expires_at, is_active, created_at, user:user_id(id, username, display_name), listing:listing_id(id, title)"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (status === "active") {
      query = query.eq("is_active", true).gte("expires_at", new Date().toISOString());
    } else if (status === "inactive") {
      query = query.eq("is_active", false);
    } else if (status === "expired") {
      query = query.lt("expires_at", new Date().toISOString());
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: data ?? [] });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin(req.headers.get("authorization"));
  if (!admin.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { id, is_active } = await req.json();
    if (!id || typeof is_active !== "boolean") {
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("classified_carousel_ads")
      .update({ is_active })
      .eq("id", id)
      .select("id, is_active")
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
