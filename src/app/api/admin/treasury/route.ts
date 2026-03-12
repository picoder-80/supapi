// src/app/api/admin/treasury/route.ts
// GET  — full treasury overview (revenue, commission, pending payouts)
// POST — process seller withdrawal (mark paid + record txid)

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";

// GET /api/admin/treasury
export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });

  const supabase = await createAdminClient();
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "all"; // all | month | week

  // Date filter
  let fromDate: string | null = null;
  if (period === "month") {
    const d = new Date(); d.setDate(1); d.setHours(0,0,0,0);
    fromDate = d.toISOString();
  } else if (period === "week") {
    const d = new Date(); d.setDate(d.getDate() - 7);
    fromDate = d.toISOString();
  }

  const revenueQuery = supabase
    .from("admin_revenue")
    .select("platform, gross_pi, commission_pi, created_at");
  if (fromDate) revenueQuery.gte("created_at", fromDate);

  const [
    { data: revenue },
    { data: pendingWithdrawals },
    { data: recentWithdrawals },
    { data: configs },
  ] = await Promise.all([
    revenueQuery,

    // Pending seller withdrawals — needs admin action
    supabase.from("seller_withdrawals")
      .select(`
        id, amount_pi, wallet_address, status, requested_at, admin_note,
        seller:seller_id(id, username, display_name, wallet_address)
      `)
      .eq("status", "pending")
      .order("requested_at", { ascending: true }),

    // Recent processed withdrawals
    supabase.from("seller_withdrawals")
      .select(`
        id, amount_pi, status, pi_txid, processed_at,
        seller:seller_id(username)
      `)
      .in("status", ["paid", "rejected"])
      .order("processed_at", { ascending: false })
      .limit(20),

    // Commission configs
    supabase.from("platform_config")
      .select("key, value")
      .like("key", "commission_%"),
  ]);

  // Aggregate by platform
  const platformBreakdown: Record<string, { gross: number; commission: number; count: number }> = {};
  (revenue ?? []).forEach(r => {
    if (!platformBreakdown[r.platform]) {
      platformBreakdown[r.platform] = { gross: 0, commission: 0, count: 0 };
    }
    platformBreakdown[r.platform].gross      += parseFloat(String(r.gross_pi));
    platformBreakdown[r.platform].commission += parseFloat(String(r.commission_pi));
    platformBreakdown[r.platform].count      += 1;
  });

  const totalGross      = Object.values(platformBreakdown).reduce((s, p) => s + p.gross, 0);
  const totalCommission = Object.values(platformBreakdown).reduce((s, p) => s + p.commission, 0);
  const totalPendingPayout = (pendingWithdrawals ?? []).reduce((s, w) => s + parseFloat(String(w.amount_pi)), 0);
  const availableBalance = totalCommission - totalPendingPayout; // rough estimate

  // Monthly trend (last 6 months)
  const monthlyTrend: Record<string, number> = {};
  (revenue ?? []).forEach(r => {
    const month = r.created_at.slice(0, 7); // YYYY-MM
    monthlyTrend[month] = (monthlyTrend[month] ?? 0) + parseFloat(String(r.commission_pi));
  });

  return NextResponse.json({
    success: true,
    data: {
      period,
      summary: {
        total_gross_pi:      Math.round(totalGross * 10000) / 10000,
        total_commission_pi: Math.round(totalCommission * 10000) / 10000,
        pending_payouts_pi:  Math.round(totalPendingPayout * 10000) / 10000,
        available_balance_pi: Math.round(availableBalance * 10000) / 10000,
      },
      by_platform:        platformBreakdown,
      monthly_trend:      monthlyTrend,
      pending_withdrawals: pendingWithdrawals ?? [],
      recent_withdrawals:  recentWithdrawals ?? [],
      commission_configs:  configs ?? [],
    },
  });
}

// POST /api/admin/treasury — process a seller withdrawal
export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });

  const supabase = await createAdminClient();
  const { withdrawal_id, action, pi_txid, admin_note } = await req.json();

  if (!withdrawal_id || !action)
    return NextResponse.json({ success: false, error: "Missing withdrawal_id or action" }, { status: 400 });

  const { data: withdrawal } = await supabase
    .from("seller_withdrawals")
    .select("id, seller_id, amount_pi, status")
    .eq("id", withdrawal_id)
    .single();

  if (!withdrawal)
    return NextResponse.json({ success: false, error: "Withdrawal not found" }, { status: 404 });

  if (withdrawal.status !== "pending")
    return NextResponse.json({ success: false, error: `Already ${withdrawal.status}` }, { status: 400 });

  if (action === "pay") {
    if (!pi_txid)
      return NextResponse.json({ success: false, error: "pi_txid required for pay action" }, { status: 400 });

    // Mark withdrawal as paid
    await supabase.from("seller_withdrawals").update({
      status:       "paid",
      pi_txid:      pi_txid,
      admin_note:   admin_note ?? null,
      processed_at: new Date().toISOString(),
    }).eq("id", withdrawal_id);

    // Mark linked earnings as paid
    await supabase.from("seller_earnings")
      .update({ status: "paid", pi_txid: pi_txid })
      .eq("withdrawal_id", withdrawal_id);

    console.log(`[Treasury] Withdrawal PAID: ${withdrawal_id} amount=${withdrawal.amount_pi}π txid=${pi_txid}`);

    return NextResponse.json({
      success: true,
      data: { status: "paid", withdrawal_id, pi_txid },
      message: `π${withdrawal.amount_pi} marked as paid to seller`,
    });
  }

  if (action === "reject") {
    await supabase.from("seller_withdrawals").update({
      status:       "rejected",
      admin_note:   admin_note ?? "Rejected by admin",
      processed_at: new Date().toISOString(),
    }).eq("id", withdrawal_id);

    // Unlock earnings back to pending
    await supabase.from("seller_earnings")
      .update({ status: "pending", withdrawal_id: null })
      .eq("withdrawal_id", withdrawal_id);

    console.log(`[Treasury] Withdrawal REJECTED: ${withdrawal_id}`);

    return NextResponse.json({
      success: true,
      data: { status: "rejected", withdrawal_id },
    });
  }

  return NextResponse.json({ success: false, error: "Invalid action. Use: pay | reject" }, { status: 400 });
}
