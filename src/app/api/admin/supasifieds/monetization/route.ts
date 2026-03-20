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

  const type = (new URL(req.url).searchParams.get("type") ?? "overview").toLowerCase();
  const now = new Date().toISOString();

  try {
    if (type === "overview") {
      const [activeListings, boostedListings, activeCarousel, activeSpotlights, activeAutoreposts, spendRows] =
        await Promise.all([
          supabase.from("classified_listings").select("id", { count: "exact", head: true }).eq("status", "active"),
          supabase.from("classified_listings").select("id", { count: "exact", head: true }).eq("is_boosted", true).gte("boost_expires_at", now),
          supabase.from("classified_carousel_ads").select("id", { count: "exact", head: true }).eq("is_active", true).gte("expires_at", now),
          supabase.from("classified_spotlights").select("id", { count: "exact", head: true }).eq("is_active", true).gte("expires_at", now),
          supabase.from("classified_autoreposts").select("id", { count: "exact", head: true }).eq("is_active", true).gte("expires_at", now),
          supabase
            .from("credit_transactions")
            .select("amount, activity, created_at")
            .in("activity", ["boost_classified", "classified_carousel_ad", "classified_spotlight", "classified_autorepost"])
            .order("created_at", { ascending: false })
            .limit(200),
        ]);

      const totalScSpend = (spendRows.data ?? []).reduce((sum, row) => sum + Math.abs(Number(row.amount ?? 0)), 0);
      return NextResponse.json({
        success: true,
        data: {
          active_listings: activeListings.count ?? 0,
          boosted_listings: boostedListings.count ?? 0,
          active_carousel: activeCarousel.count ?? 0,
          active_spotlights: activeSpotlights.count ?? 0,
          active_autoreposts: activeAutoreposts.count ?? 0,
          monetization_sc_spend_recent: totalScSpend,
          recent_transactions: spendRows.data ?? [],
        },
      });
    }

    if (type === "carousel") {
      const { data, error } = await supabase
        .from("classified_carousel_ads")
        .select(
          "id, headline, image_url, cta_label, link_url, sc_cost, starts_at, expires_at, is_active, created_at, user:user_id(id, username, display_name), listing:listing_id(id, title)"
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, data: data ?? [] });
    }

    if (type === "spotlights") {
      const { data, error } = await supabase
        .from("classified_spotlights")
        .select("id, listing_id, user_id, category, sc_cost, starts_at, expires_at, is_active, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, data: data ?? [] });
    }

    if (type === "autoreposts") {
      const { data, error } = await supabase
        .from("classified_autoreposts")
        .select("id, listing_id, user_id, interval_hours, sc_cost, starts_at, next_run_at, expires_at, is_active, runs_count, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, data: data ?? [] });
    }

    return NextResponse.json({ success: false, error: "Invalid type" }, { status: 400 });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin(req.headers.get("authorization"));
  if (!admin.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const { type, id, is_active } = await req.json();
    if (!type || !id || typeof is_active !== "boolean") {
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }
    const table =
      type === "carousel" ? "classified_carousel_ads" : type === "spotlights" ? "classified_spotlights" : type === "autoreposts" ? "classified_autoreposts" : null;
    if (!table) return NextResponse.json({ success: false, error: "Invalid type" }, { status: 400 });

    const { data, error } = await supabase.from(table).update({ is_active }).eq("id", id).select("id, is_active").single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
