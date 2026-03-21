import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { computePiAmount, DEFAULT_SPREAD_PCT, QUOTE_TTL_SECONDS } from "@/lib/supaminds/subscription";

export async function POST(req: NextRequest) {
  try {
    const rl = checkRateLimit(req, "mind_quote_create", 20, 60_000);
    if (!rl.ok) return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });

    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload?.userId) return NextResponse.json({ success: false }, { status: 401 });

    const body = await req.json();
    const planCode = String(body?.plan_code ?? "").trim();
    if (!planCode || planCode === "free") return NextResponse.json({ success: false, error: "Invalid plan" }, { status: 400 });

    const supabase = await createAdminClient();
    const { data: plan } = await supabase
      .from("mind_plans")
      .select("id, code, name, price_usd")
      .eq("code", planCode)
      .eq("active", true)
      .maybeSingle();
    if (!plan) return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });

    const priceRes = await fetch(`${req.nextUrl.origin}/api/pi-price`, { cache: "no-store" });
    const priceData = await priceRes.json().catch(() => ({}));
    const piRate = Number(priceData?.price ?? 0);
    if (!(piRate > 0)) return NextResponse.json({ success: false, error: "Unable to fetch Pi price" }, { status: 503 });

    const amountUsd = Number(plan.price_usd ?? 0);
    const amountPi = computePiAmount(amountUsd, piRate, DEFAULT_SPREAD_PCT);
    const expiresAt = new Date(Date.now() + QUOTE_TTL_SECONDS * 1000).toISOString();

    const { data: invoice, error: invErr } = await supabase
      .from("mind_invoices")
      .insert({
        user_id: payload.userId,
        plan_id: plan.id,
        status: "quote",
        amount_usd: amountUsd,
        pi_usd_rate: piRate,
        spread_pct: DEFAULT_SPREAD_PCT,
        amount_pi: amountPi,
        quote_expires_at: expiresAt,
        due_at: expiresAt,
      })
      .select("id, amount_usd, amount_pi, pi_usd_rate, quote_expires_at, status")
      .single();
    if (invErr || !invoice) return NextResponse.json({ success: false, error: invErr?.message ?? "Failed to create quote" }, { status: 500 });

    return NextResponse.json({ success: true, data: { plan, invoice } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
