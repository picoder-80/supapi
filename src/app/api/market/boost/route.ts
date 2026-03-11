// src/app/api/market/boost/route.ts
// POST — boost a listing using SC

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getUserId(req: NextRequest): string | null {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return String(decoded.userId ?? decoded.id ?? decoded.sub ?? "");
  } catch { return null; }
}

// Boost tiers
const BOOST_TIERS: Record<string, { sc: number; hrs: number; label: string }> = {
  bronze: { sc: 100, hrs: 24,  label: "🥉 Bronze Boost · 24h" },
  silver: { sc: 250, hrs: 48,  label: "🥈 Silver Boost · 48h" },
  gold:   { sc: 500, hrs: 72,  label: "👑 Gold Boost · 72h"   },
};

export async function GET(req: NextRequest) {
  return NextResponse.json({ success: true, data: { tiers: BOOST_TIERS } });
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { listing_id, tier } = body;

  const boostTier = BOOST_TIERS[tier];
  if (!boostTier) return NextResponse.json({ success: false, error: "Invalid tier" }, { status: 400 });

  try {
    // Verify listing belongs to user
    const { data: listing } = await supabase.from("listings")
      .select("id, title, is_boosted, boost_expires_at, status")
      .eq("id", listing_id).eq("seller_id", userId).single();

    if (!listing) return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 });
    if (listing.status !== "active") return NextResponse.json({ success: false, error: "Listing is not active" }, { status: 400 });

    // Check if already boosted
    if (listing.is_boosted && listing.boost_expires_at && new Date(listing.boost_expires_at) > new Date()) {
      return NextResponse.json({ success: false, error: `Already boosted until ${new Date(listing.boost_expires_at).toLocaleString()}` }, { status: 400 });
    }

    // Check SC balance
    await supabase.from("supapi_credits").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
    const { data: wallet } = await supabase.from("supapi_credits")
      .select("balance, total_spent").eq("user_id", userId).single();

    if (!wallet || wallet.balance < boostTier.sc) {
      return NextResponse.json({ success: false, error: `Insufficient SC. Need ${boostTier.sc} SC, you have ${wallet?.balance ?? 0} SC` }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + boostTier.hrs * 3600000).toISOString();

    // Deduct SC
    await supabase.from("supapi_credits").update({
      balance:     wallet.balance - boostTier.sc,
      total_spent: wallet.total_spent + boostTier.sc,
    }).eq("user_id", userId);

    await supabase.from("credit_transactions").insert({
      user_id:      userId,
      type:         "spend",
      activity:     "boost_listing",
      amount:       -boostTier.sc,
      balance_after: wallet.balance - boostTier.sc,
      note:         `🚀 ${boostTier.label} — "${listing.title}"`,
    });

    // Boost the listing
    await supabase.from("listings").update({
      is_boosted:       true,
      boost_tier:       tier,
      boost_expires_at: expiresAt,
      updated_at:       new Date().toISOString(),
    }).eq("id", listing_id);

    // Log boost history
    await supabase.from("listing_boosts").insert({
      listing_id,
      user_id:      userId,
      tier,
      sc_cost:      boostTier.sc,
      duration_hrs: boostTier.hrs,
      boosted_at:   new Date().toISOString(),
      expires_at:   expiresAt,
    });

    // SC reward for boosting (small, encouraging)
    await supabase.from("market_sc_events").insert({
      user_id: userId, event: "boost_purchased", ref_id: listing_id, sc_amount: 0,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        tier,
        sc_spent:   boostTier.sc,
        expires_at: expiresAt,
        label:      boostTier.label,
        new_balance: wallet.balance - boostTier.sc,
      }
    });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
