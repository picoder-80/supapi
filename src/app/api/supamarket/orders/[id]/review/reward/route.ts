import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: orderId } = await params;
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const supabase = await createAdminClient();
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, buyer_id, listing_id, status")
      .eq("id", orderId)
      .single();
    if (orderErr || !order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }
    if (order.buyer_id !== payload.userId) {
      return NextResponse.json({ success: false, error: "Only buyer can claim review reward" }, { status: 403 });
    }

    const reward = Math.max(0, Number(process.env.MARKET_REVIEW_SC_REWARD ?? "20"));
    if (reward <= 0) {
      return NextResponse.json({ success: false, error: "Review reward disabled" }, { status: 400 });
    }

    const listingId = String(order.listing_id ?? "");
    if (!listingId) {
      return NextResponse.json({ success: false, error: "Order has no listing" }, { status: 400 });
    }
    const { data: review } = await supabase
      .from("reviews")
      .select("id")
      .eq("target_type", "listing")
      .eq("target_id", listingId)
      .eq("reviewer_id", payload.userId)
      .maybeSingle();
    if (!review) {
      return NextResponse.json({ success: false, error: "Submit review first" }, { status: 400 });
    }

    const refId = `market_order_review:${orderId}`;
    const { data: existingTx } = await supabase
      .from("credit_transactions")
      .select("id, amount")
      .eq("user_id", payload.userId)
      .eq("activity", "market_review")
      .eq("ref_id", refId)
      .limit(1)
      .maybeSingle();
    if (existingTx) {
      return NextResponse.json({ success: true, data: { sc_rewarded: false, already_claimed: true, sc_amount: Number(existingTx.amount ?? reward) } });
    }

    await supabase.from("supapi_credits").upsert({ user_id: payload.userId }, { onConflict: "user_id", ignoreDuplicates: true });
    const { data: wallet } = await supabase
      .from("supapi_credits")
      .select("balance, total_earned")
      .eq("user_id", payload.userId)
      .single();
    const nextBalance = Number(wallet?.balance ?? 0) + reward;
    const nextEarned = Number(wallet?.total_earned ?? 0) + reward;
    const { error: walletErr } = await supabase
      .from("supapi_credits")
      .update({ balance: nextBalance, total_earned: nextEarned, updated_at: new Date().toISOString() })
      .eq("user_id", payload.userId);
    if (walletErr) {
      return NextResponse.json({ success: false, error: "Unable to update wallet" }, { status: 500 });
    }

    const { error: txErr } = await supabase.from("credit_transactions").insert({
      user_id: payload.userId,
      type: "earn",
      activity: "market_review",
      amount: reward,
      balance_after: nextBalance,
      ref_id: refId,
      note: `SupaMarket review reward · order ${orderId.slice(0, 8)}`,
    });
    if (txErr) {
      return NextResponse.json({ success: false, error: "Unable to record reward transaction" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        sc_rewarded: true,
        sc_amount: reward,
        sc_balance: nextBalance,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
