import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const supabase = await createAdminClient();
    const uid = payload.userId;

    const [
      ordersRes,
      purchaseOrdersRes,
      purchaseLegacyTxRes,
      referralsRes,
      earningsRes,
      txRes,
      creditsRes,
      listingsRes,
      gigsRes,
      recentOrdersRes,
      creditTxRes,
      petsRes,
      profileRewardClaimRes,
    ] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true })
        .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`),
      supabase.from("orders").select("id", { count: "exact", head: true })
        .eq("buyer_id", uid),
      supabase.from("transactions").select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("status", "completed")
        .eq("reference_type", "listing"),
      supabase.from("referrals").select("id", { count: "exact", head: true })
        .eq("referrer_id", uid),
      // Earnings for the user are tracked in earnings_wallet/earnings_transactions (seller + platform payouts).
      supabase.from("earnings_wallet").select("total_earned").maybeSingle(),
      supabase.from("transactions").select("id, type, amount_pi, memo, status, created_at")
        .eq("user_id", uid).order("created_at", { ascending: false }).limit(5),
      supabase.from("supapi_credits").select("balance").eq("user_id", uid).maybeSingle(),
      supabase.from("listings").select("id", { count: "exact", head: true })
        .eq("seller_id", uid).eq("status", "active"),
      supabase.from("gigs").select("id", { count: "exact", head: true })
        .eq("seller_id", uid).eq("status", "active"),
      supabase.from("orders")
        .select("id, status, amount_pi, created_at, listing:listing_id(title)")
        .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("credit_transactions")
        .select("id, type, amount, activity, note, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("supapets_pets").select("id", { count: "exact", head: true }).eq("user_id", uid),
      supabase.from("credit_transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("activity", "complete_profile"),
    ]);

    const earned = Number(earningsRes.data?.total_earned ?? 0);
    const scBalance = creditsRes.data?.balance ?? 0;

    const purchaseOrdersCount = Number(purchaseOrdersRes.count ?? 0);
    const purchaseLegacyCount = Number(purchaseLegacyTxRes.count ?? 0);
    // Legacy compatibility: old purchases may only exist as completed listing transactions.
    const purchaseCount = Math.max(purchaseOrdersCount, purchaseLegacyCount);

    return NextResponse.json({
      success: true,
      data: {
        orders: ordersRes.count ?? 0,
        purchase_orders: purchaseCount,
        referrals: referralsRes.count ?? 0,
        earned: earned.toFixed(2),
        transactions: txRes.data ?? [],
        sc_balance: Number(scBalance),
        listings: listingsRes.count ?? 0,
        gigs: gigsRes.count ?? 0,
        recent_orders: recentOrdersRes.data ?? [],
        credit_transactions: creditTxRes.data ?? [],
        pets: petsRes.count ?? 0,
        profile_reward_claimed: Number(profileRewardClaimRes.count ?? 0) > 0,
      },
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}