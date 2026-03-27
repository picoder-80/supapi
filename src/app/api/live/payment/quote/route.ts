// POST /api/live/payment/quote — create payment quote for go live
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { computePiAmount, LIVE_SPREAD_PCT, LIVE_QUOTE_TTL_SECONDS, hasActiveLiveSubscription } from "@/lib/live/payments";

export async function POST(req: NextRequest) {
  try {
    const rl = checkRateLimit(req, "live_quote_create", 10, 60_000);
    if (!rl.ok) return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });

    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload?.userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const planCode = String(body?.plan_code ?? "").trim();
    if (!planCode) return NextResponse.json({ success: false, error: "plan_code required" }, { status: 400 });

    const supabase = await createAdminClient();

    // If user has active monthly, no payment needed for session
    if (planCode === "live_session") {
      const hasMonthly = await hasActiveLiveSubscription(supabase, payload.userId);
      if (hasMonthly) {
        return NextResponse.json({
          success: true,
          data: { free: true, message: "Covered by monthly plan" },
        });
      }
    }

    const { data: plan } = await supabase
      .from("live_plans")
      .select("id, code, name, price_usd, plan_type")
      .eq("code", planCode)
      .eq("active", true)
      .maybeSingle();
    if (!plan) return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });

    const priceRes = await fetch(`${req.nextUrl.origin}/api/pi-price`, { cache: "no-store" });
    const priceData = await priceRes.json().catch(() => ({}));
    const piRate = Number(priceData?.price ?? 0);
    if (!(piRate > 0)) return NextResponse.json({ success: false, error: "Unable to fetch Pi price" }, { status: 503 });

    const amountUsd = Number(plan.price_usd);
    const amountPi = computePiAmount(amountUsd, piRate, LIVE_SPREAD_PCT);
    const expiresAt = new Date(Date.now() + LIVE_QUOTE_TTL_SECONDS * 1000).toISOString();

    const { data: invoice, error: invErr } = await supabase
      .from("live_invoices")
      .insert({
        user_id: payload.userId,
        plan_id: plan.id,
        status: "quote",
        amount_usd: amountUsd,
        pi_usd_rate: piRate,
        spread_pct: LIVE_SPREAD_PCT,
        amount_pi: amountPi,
        quote_expires_at: expiresAt,
      })
      .select("id, amount_usd, amount_pi, pi_usd_rate, quote_expires_at, status")
      .single();

    if (invErr || !invoice) return NextResponse.json({ success: false, error: invErr?.message ?? "Failed to create quote" }, { status: 500 });

    return NextResponse.json({ success: true, data: { plan, invoice, free: false } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
