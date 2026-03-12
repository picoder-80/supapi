// src/app/api/seller/earnings/route.ts
// GET  — seller views their earnings summary + history
// POST — seller requests withdrawal

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getUser(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; username: string };
  } catch { return null; }
}

async function getHoldDays(): Promise<number> {
  const { data } = await supabase
    .from("platform_config").select("value").eq("key", "seller_hold_days").single();
  return parseInt(data?.value ?? "3");
}

// GET /api/seller/earnings
export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const holdDays = await getHoldDays();
  const holdDate = new Date();
  holdDate.setDate(holdDate.getDate() - holdDays);

  const [
    { data: claimable },
    { data: pending },
    { data: history },
    { data: withdrawals },
  ] = await Promise.all([
    // Claimable — past hold period
    supabase.from("seller_earnings")
      .select("id, net_pi, gross_pi, commission_pi, commission_pct, platform, order_id, created_at")
      .eq("seller_id", user.userId)
      .eq("status", "pending")
      .lte("created_at", holdDate.toISOString()),

    // Still in hold period
    supabase.from("seller_earnings")
      .select("id, net_pi, platform, created_at")
      .eq("seller_id", user.userId)
      .eq("status", "pending")
      .gt("created_at", holdDate.toISOString()),

    // All earnings history
    supabase.from("seller_earnings")
      .select("id, net_pi, gross_pi, commission_pi, commission_pct, platform, status, created_at")
      .eq("seller_id", user.userId)
      .order("created_at", { ascending: false })
      .limit(30),

    // Withdrawal history
    supabase.from("seller_withdrawals")
      .select("id, amount_pi, status, pi_txid, admin_note, requested_at, processed_at")
      .eq("seller_id", user.userId)
      .order("requested_at", { ascending: false })
      .limit(20),
  ]);

  const claimableTotal = (claimable ?? []).reduce((s, e) => s + parseFloat(String(e.net_pi)), 0);
  const pendingTotal   = (pending ?? []).reduce((s, e) => s + parseFloat(String(e.net_pi)), 0);

  // When earliest pending becomes claimable
  const earliestPending = (pending ?? []).length
    ? new Date(Math.min(...(pending ?? []).map(e => new Date(e.created_at).getTime())))
    : null;
  const claimableDate = earliestPending
    ? new Date(earliestPending.getTime() + holdDays * 86400000)
    : null;

  // Earnings by platform breakdown
  const byPlatform: Record<string, number> = {};
  (history ?? []).forEach(e => {
    byPlatform[e.platform] = (byPlatform[e.platform] ?? 0) + parseFloat(String(e.net_pi));
  });

  return NextResponse.json({
    success: true,
    data: {
      claimable_pi:   Math.round(claimableTotal * 10000) / 10000,
      pending_pi:     Math.round(pendingTotal * 10000) / 10000,
      claimable_date: claimableDate,
      hold_days:      holdDays,
      claimable_ids:  (claimable ?? []).map(e => e.id),
      by_platform:    byPlatform,
      history:        history ?? [],
      withdrawals:    withdrawals ?? [],
    },
  });
}

// POST /api/seller/earnings — request withdrawal
export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { amount } = await req.json();
  if (!amount || amount <= 0)
    return NextResponse.json({ success: false, error: "Invalid amount" }, { status: 400 });

  const holdDays = await getHoldDays();
  const holdDate = new Date();
  holdDate.setDate(holdDate.getDate() - holdDays);

  // Get claimable earnings
  const { data: claimable } = await supabase
    .from("seller_earnings")
    .select("id, net_pi")
    .eq("seller_id", user.userId)
    .eq("status", "pending")
    .lte("created_at", holdDate.toISOString());

  const claimableTotal = (claimable ?? []).reduce((s, e) => s + parseFloat(String(e.net_pi)), 0);

  if (claimableTotal < amount - 0.0001)
    return NextResponse.json({ success: false, error: "Insufficient claimable balance" }, { status: 400 });

  // Get seller wallet address
  const { data: sellerUser } = await supabase
    .from("users")
    .select("wallet_address")
    .eq("id", user.userId)
    .single();

  // Create withdrawal request
  const { data: withdrawal, error } = await supabase
    .from("seller_withdrawals")
    .insert({
      seller_id:      user.userId,
      amount_pi:      amount,
      wallet_address: sellerUser?.wallet_address ?? null,
      status:         "pending",
    })
    .select("id")
    .single();

  if (error || !withdrawal)
    return NextResponse.json({ success: false, error: "Failed to create withdrawal request" }, { status: 500 });

  // Lock earnings
  const earningIds = (claimable ?? []).map(e => e.id);
  await supabase
    .from("seller_earnings")
    .update({ status: "processing", withdrawal_id: withdrawal.id })
    .in("id", earningIds);

  console.log(`[Seller Withdrawal] userId=${user.userId} amount=${amount}π withdrawal=${withdrawal.id}`);

  return NextResponse.json({
    success: true,
    data: {
      withdrawal_id: withdrawal.id,
      amount_pi:     amount,
      wallet_address: sellerUser?.wallet_address,
      message: "Withdrawal request submitted. Admin will process within 1-3 business days.",
    },
  });
}
