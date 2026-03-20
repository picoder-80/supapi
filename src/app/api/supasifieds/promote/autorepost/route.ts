import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const AUTO_REPOST_PACKAGES: Record<string, { interval_hours: number; days: number; sc: number; label: string }> = {
  "24h_7d": { interval_hours: 24, days: 7, sc: 120, label: "Every 24h for 7 days" },
  "12h_7d": { interval_hours: 12, days: 7, sc: 200, label: "Every 12h for 7 days" },
  "6h_14d": { interval_hours: 6, days: 14, sc: 420, label: "Every 6h for 14 days" },
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

  const { listing_id, package_id } = await req.json();
  const pkg = AUTO_REPOST_PACKAGES[String(package_id ?? "")];
  if (!listing_id || !pkg) return NextResponse.json({ success: false, error: "Invalid package" }, { status: 400 });

  try {
    const { data: listing } = await supabase
      .from("classified_listings")
      .select("id, title, status")
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

    const now = new Date();
    const expiresAt = new Date(now.getTime() + pkg.days * 24 * 3600000).toISOString();
    const nextRun = new Date(now.getTime() + pkg.interval_hours * 3600000).toISOString();
    const newBalance = wallet.balance - pkg.sc;

    await supabase
      .from("supapi_credits")
      .update({ balance: newBalance, total_spent: wallet.total_spent + pkg.sc })
      .eq("user_id", userId);

    await supabase.from("credit_transactions").insert({
      user_id: userId,
      type: "spend",
      activity: "classified_autorepost",
      amount: -pkg.sc,
      balance_after: newBalance,
      note: `🔁 Auto-repost: ${listing.title} (${pkg.label})`,
    });

    await supabase
      .from("classified_listings")
      .update({ created_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("id", listing_id);

    const { data, error } = await supabase
      .from("classified_autoreposts")
      .insert({
        listing_id,
        user_id: userId,
        interval_hours: pkg.interval_hours,
        sc_cost: pkg.sc,
        starts_at: now.toISOString(),
        next_run_at: nextRun,
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
