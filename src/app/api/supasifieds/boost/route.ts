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

export async function GET() {
  const config = await getSupasifiedsMonetizationConfig(supabase);
  return NextResponse.json({ success: true, data: { tiers: config.boostTiers } });
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { classified_id, tier } = body;

  const config = await getSupasifiedsMonetizationConfig(supabase);
  const boostTier = config.boostTiers[tier];
  if (!boostTier) return NextResponse.json({ success: false, error: "Invalid tier" }, { status: 400 });

  try {
    const { data: row } = await supabase
      .from("classified_listings")
      .select("id, title, is_boosted, boost_expires_at, status")
      .eq("id", classified_id)
      .eq("seller_id", userId)
      .single();

    if (!row) return NextResponse.json({ success: false, error: "Ad not found" }, { status: 404 });
    if (row.status !== "active") {
      return NextResponse.json({ success: false, error: "Ad is not active" }, { status: 400 });
    }

    if (row.is_boosted && row.boost_expires_at && new Date(row.boost_expires_at) > new Date()) {
      return NextResponse.json(
        { success: false, error: `Already boosted until ${new Date(row.boost_expires_at).toLocaleString()}` },
        { status: 400 }
      );
    }

    await supabase.from("supapi_credits").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
    const { data: wallet } = await supabase
      .from("supapi_credits")
      .select("balance, total_spent")
      .eq("user_id", userId)
      .single();

    if (!wallet || wallet.balance < boostTier.sc) {
      return NextResponse.json(
        { success: false, error: `Insufficient SC. Need ${boostTier.sc} SC, you have ${wallet?.balance ?? 0} SC` },
        { status: 400 }
      );
    }

    const expiresAt = new Date(Date.now() + boostTier.hrs * 3600000).toISOString();

    await supabase
      .from("supapi_credits")
      .update({
        balance: wallet.balance - boostTier.sc,
        total_spent: wallet.total_spent + boostTier.sc,
      })
      .eq("user_id", userId);

    await supabase.from("credit_transactions").insert({
      user_id: userId,
      type: "spend",
      activity: "boost_classified",
      amount: -boostTier.sc,
      balance_after: wallet.balance - boostTier.sc,
      note: `🚀 ${boostTier.label} — classified "${row.title}"`,
    });

    await supabase
      .from("classified_listings")
      .update({
        is_boosted: true,
        boost_tier: tier,
        boost_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", classified_id);

    await supabase.from("classified_boosts").insert({
      classified_id,
      user_id: userId,
      tier,
      sc_cost: boostTier.sc,
      duration_hrs: boostTier.hrs,
      boosted_at: new Date().toISOString(),
      expires_at: expiresAt,
    });

    return NextResponse.json({
      success: true,
      data: {
        tier,
        sc_spent: boostTier.sc,
        expires_at: expiresAt,
        label: boostTier.label,
        new_balance: wallet.balance - boostTier.sc,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
