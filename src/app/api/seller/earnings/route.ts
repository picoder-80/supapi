// src/app/api/seller/earnings/route.ts
// GET  — seller views their earnings summary + history
// POST — seller requests withdrawal

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { executeOwnerTransfer, isOwnerTransferConfigured } from "@/lib/pi/payout";

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

// POST /api/seller/earnings — execute A2U withdrawal and mark records paid
export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { amount } = await req.json();
  if (!amount || amount <= 0)
    return NextResponse.json({ success: false, error: "Invalid amount" }, { status: 400 });
  if (!isOwnerTransferConfigured()) {
    return NextResponse.json({ success: false, error: "Pi payout not configured. Contact admin." }, { status: 503 });
  }

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
  // Keep accounting exact. Existing flow already withdraws total claimable amount.
  if (Math.abs(claimableTotal - Number(amount)) > 0.0001) {
    return NextResponse.json({
      success: false,
      error: `Please withdraw full claimable amount (${claimableTotal.toFixed(4)}π).`,
    }, { status: 400 });
  }

  // Get seller wallet address
  const { data: sellerUser } = await supabase
    .from("users")
    .select("wallet_address, wallet_verified, pi_uid")
    .eq("id", user.userId)
    .single();
  const recipientUid = String((sellerUser as { pi_uid?: string } | null)?.pi_uid ?? "").trim();
  const destinationWallet = String((sellerUser as { wallet_address?: string } | null)?.wallet_address ?? "").trim();
  const hasActivatedWallet = !!destinationWallet || !!(sellerUser as { wallet_verified?: boolean } | null)?.wallet_verified;
  if (!recipientUid || !hasActivatedWallet) {
    return NextResponse.json({
      success: false,
      error: "You must sign in with Pi and activate your wallet before withdrawing.",
    }, { status: 400 });
  }

  // Create withdrawal record
  const { data: withdrawal, error } = await supabase
    .from("seller_withdrawals")
    .insert({
      seller_id:      user.userId,
      amount_pi:      amount,
      wallet_address: destinationWallet || null,
      status:         "pending",
    })
    .select("id, amount_pi")
    .single();

  if (error || !withdrawal)
    return NextResponse.json({ success: false, error: "Failed to create withdrawal" }, { status: 500 });

  // Lock earnings before transfer
  const earningIds = (claimable ?? []).map(e => e.id);
  await supabase
    .from("seller_earnings")
    .update({ status: "processing", withdrawal_id: withdrawal.id })
    .in("id", earningIds);

  const transfer = await executeOwnerTransfer({
    amountPi: Number(withdrawal.amount_pi),
    recipientUid: recipientUid || undefined,
    destinationWallet: destinationWallet || undefined,
    note: `Seller withdrawal ${withdrawal.id}`,
  });
  if (!transfer.ok || !transfer.txid) {
    await supabase
      .from("seller_earnings")
      .update({ status: "pending", withdrawal_id: null })
      .eq("withdrawal_id", withdrawal.id);
    await supabase
      .from("seller_withdrawals")
      .update({ status: "rejected", admin_note: transfer.message ?? "A2U payout failed", processed_at: new Date().toISOString() })
      .eq("id", withdrawal.id);
    return NextResponse.json({ success: false, error: transfer.message ?? "A2U payout failed" }, { status: 502 });
  }

  await supabase.from("seller_withdrawals").update({
    status: "paid",
    pi_txid: transfer.txid,
    admin_note: "A2U payout",
    processed_at: new Date().toISOString(),
  }).eq("id", withdrawal.id);
  await supabase
    .from("seller_earnings")
    .update({ status: "paid", pi_txid: transfer.txid })
    .eq("withdrawal_id", withdrawal.id);

  console.log(`[Seller Withdrawal A2U] userId=${user.userId} amount=${amount}π withdrawal=${withdrawal.id} txid=${transfer.txid}`);

  return NextResponse.json({
    success: true,
    data: {
      withdrawal_id: withdrawal.id,
      amount_pi: Number(withdrawal.amount_pi),
      wallet_address: destinationWallet || null,
      pi_txid: transfer.txid,
      status: "paid",
      message: "Withdrawal sent successfully via A2U.",
    },
  });
}
