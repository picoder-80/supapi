import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload?.userId) return NextResponse.json({ success: false }, { status: 401 });
    const supabase = await createAdminClient();

    const { data: sub } = await supabase
      .from("mind_subscriptions")
      .select(`
        *,
        plan:plan_id ( id, code, name, price_usd, features )
      `)
      .eq("user_id", payload.userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: plans } = await supabase
      .from("mind_plans")
      .select("id, code, name, price_usd, interval_unit, interval_count, active, features")
      .eq("active", true)
      .order("price_usd", { ascending: true });

    const { data: invoices } = await supabase
      .from("mind_invoices")
      .select("id, status, amount_usd, amount_pi, pi_usd_rate, quote_expires_at, created_at, paid_at")
      .eq("user_id", payload.userId)
      .order("created_at", { ascending: false })
      .limit(8);

    const { data: packs } = await supabase
      .from("mind_topup_packs")
      .select("id, code, name, prompts, price_usd, active, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    const { data: topups } = await supabase
      .from("mind_topup_ledger")
      .select("id, prompts_remaining, status")
      .eq("user_id", payload.userId)
      .eq("status", "active");
    const topupBalance = (topups ?? []).reduce((acc: number, t: any) => acc + Number(t.prompts_remaining ?? 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        subscription: sub ?? null,
        plans: plans ?? [],
        invoices: invoices ?? [],
        topup_packs: packs ?? [],
        topup_balance: topupBalance,
      },
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload?.userId) return NextResponse.json({ success: false }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "").trim().toLowerCase();
    if (!["cancel", "resume"].includes(action)) {
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }
    const supabase = await createAdminClient();

    const { data: sub } = await supabase
      .from("mind_subscriptions")
      .select("id")
      .eq("user_id", payload.userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) return NextResponse.json({ success: false, error: "Subscription not found" }, { status: 404 });

    const patch = action === "cancel"
      ? { cancel_at_period_end: true, status: "canceled", canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      : { cancel_at_period_end: false, status: "active", canceled_at: null, updated_at: new Date().toISOString() };

    const { error } = await supabase
      .from("mind_subscriptions")
      .update(patch)
      .eq("id", sub.id);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
