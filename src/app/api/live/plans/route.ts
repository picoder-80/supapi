// GET /api/live/plans — fetch available live plans + user subscription status
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";
import { hasActiveLiveSubscription } from "@/lib/live/payments";

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const payload = auth ? verifyToken(auth) : null;
    const userId = payload?.userId ?? null;

    const supabase = await createAdminClient();

    const { data: plans } = await supabase
      .from("live_plans")
      .select("id, code, name, price_usd, plan_type, features")
      .eq("active", true)
      .order("price_usd", { ascending: true });

    let hasMonthly = false;
    let subscription = null;

    if (userId) {
      hasMonthly = await hasActiveLiveSubscription(supabase, userId);
      if (hasMonthly) {
        const { data: sub } = await supabase
          .from("live_subscriptions")
          .select("id, status, current_period_end, cancel_at_period_end")
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle();
        subscription = sub;
      }
    }

    // Fetch live Pi rate
    const priceRes = await fetch(`${req.nextUrl.origin}/api/pi-price`, { cache: "no-store" });
    const priceData = await priceRes.json().catch(() => ({}));
    const piRate = Number(priceData?.price ?? 0);

    return NextResponse.json({
      success: true,
      data: { plans: plans ?? [], has_monthly: hasMonthly, subscription, pi_rate: piRate },
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
