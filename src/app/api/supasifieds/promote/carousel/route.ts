import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { getSupasifiedsMonetizationConfig } from "@/lib/supasifieds/monetization-config";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getUserId(req: NextRequest): string | null {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId?: string; id?: string; sub?: string };
    return String(decoded.userId ?? decoded.id ?? decoded.sub ?? "");
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { listing_id, image_url, headline, cta_label, link_url, duration_days } = await req.json();
  const days = Number(duration_days);
  const config = await getSupasifiedsMonetizationConfig(supabase);
  const pkg = config.carouselPackages.find((row) => row.days === days);
  if (!pkg || !image_url || !headline || !link_url) {
    return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
  }

  try {
    if (listing_id) {
      const { data: listing } = await supabase
        .from("classified_listings")
        .select("id")
        .eq("id", listing_id)
        .eq("seller_id", userId)
        .single();
      if (!listing) return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 });
    }

    await supabase.from("supapi_credits").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
    const { data: wallet } = await supabase
      .from("supapi_credits")
      .select("balance, total_spent")
      .eq("user_id", userId)
      .single();
    if (!wallet || wallet.balance < pkg.sc) {
      return NextResponse.json({ success: false, error: `Insufficient SC. Need ${pkg.sc} SC.` }, { status: 400 });
    }

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + days * 24 * 3600000).toISOString();
    const newBalance = wallet.balance - pkg.sc;

    await supabase
      .from("supapi_credits")
      .update({ balance: newBalance, total_spent: wallet.total_spent + pkg.sc })
      .eq("user_id", userId);

    await supabase.from("credit_transactions").insert({
      user_id: userId,
      type: "spend",
      activity: "classified_carousel_ad",
      amount: -pkg.sc,
      balance_after: newBalance,
      note: `🎠 Carousel ad (${pkg.label})`,
    });

    const { data, error } = await supabase
      .from("classified_carousel_ads")
      .insert({
        user_id: userId,
        listing_id: listing_id ?? null,
        image_url: String(image_url).trim(),
        headline: String(headline).trim(),
        cta_label: String(cta_label || "View").trim(),
        link_url: String(link_url).trim(),
        sc_cost: pkg.sc,
        starts_at: now,
        expires_at: expiresAt,
        is_active: true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
