import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CAROUSEL_PACKAGES: Record<number, { sc: number; label: string }> = {
  3: { sc: 180, label: "3 days carousel ad" },
  7: { sc: 360, label: "7 days carousel ad" },
  14: { sc: 650, label: "14 days carousel ad" },
};

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
  const pkg = CAROUSEL_PACKAGES[days];
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
