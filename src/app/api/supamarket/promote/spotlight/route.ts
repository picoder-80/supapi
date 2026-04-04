import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SPOTLIGHT_PACKAGES = [
  { days: 3, sc: 120, label: "3 days category spotlight" },
  { days: 7, sc: 250, label: "7 days category spotlight" },
  { days: 14, sc: 450, label: "14 days category spotlight" },
];

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

  const { listing_id, duration_days } = await req.json();
  const days = Number(duration_days);
  const pkg = SPOTLIGHT_PACKAGES.find((row) => row.days === days);
  if (!listing_id || !pkg) return NextResponse.json({ success: false, error: "Invalid package" }, { status: 400 });

  try {
    const { data: listing } = await supabase
      .from("listings")
      .select("id, title, category, status")
      .eq("id", listing_id)
      .eq("seller_id", userId)
      .single();
    if (!listing) return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 });
    if (listing.status !== "active") return NextResponse.json({ success: false, error: "Listing must be active" }, { status: 400 });

    await supabase.from("supapi_credits").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
    const { data: wallet } = await supabase
      .from("supapi_credits")
      .select("balance, total_spent")
      .eq("user_id", userId)
      .single();
    if (!wallet || wallet.balance < pkg.sc) {
      return NextResponse.json({ success: false, error: `Insufficient SC. Need ${pkg.sc} SC.` }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + days * 24 * 3600000).toISOString();
    const newBalance = wallet.balance - pkg.sc;

    await supabase
      .from("supapi_credits")
      .update({ balance: newBalance, total_spent: wallet.total_spent + pkg.sc })
      .eq("user_id", userId);

    await supabase.from("credit_transactions").insert({
      user_id: userId,
      type: "spend",
      activity: "market_spotlight",
      amount: -pkg.sc,
      balance_after: newBalance,
      note: `⭐ Market spotlight: ${listing.title} (${pkg.label})`,
    });

    const { data, error } = await supabase
      .from("market_spotlights")
      .insert({
        listing_id,
        user_id: userId,
        category: listing.category ?? null,
        sc_cost: pkg.sc,
        starts_at: new Date().toISOString(),
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
