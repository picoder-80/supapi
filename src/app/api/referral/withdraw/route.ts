import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { executeOwnerTransfer, isOwnerTransferConfigured } from "@/lib/pi/payout";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getUser(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; username: string };
  } catch { return null; }
}

async function getConfig(key: string): Promise<number> {
  const { data } = await supabase.from("platform_config").select("value").eq("key", key).single();
  return parseFloat(data?.value ?? "0");
}

// GET /api/referral/withdraw — get claimable amount + withdrawal history
export async function GET(req: Request) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const holdDays = await getConfig("referral_hold_days");
  const holdDate = new Date();
  holdDate.setDate(holdDate.getDate() - holdDays);

  // Get claimable earnings (past hold period, not yet withdrawn)
  const { data: claimable } = await supabase
    .from("referral_earnings")
    .select("id, earned_pi, platform, level, created_at")
    .eq("earner_id", user.userId)
    .eq("status", "pending")
    .lte("created_at", holdDate.toISOString());

  // Get pending earnings (still in hold period)
  const { data: pending } = await supabase
    .from("referral_earnings")
    .select("id, earned_pi, created_at")
    .eq("earner_id", user.userId)
    .eq("status", "pending")
    .gt("created_at", holdDate.toISOString());

  // Get withdrawal history
  const { data: history } = await supabase
    .from("referral_withdrawals")
    .select("id, amount_pi, pi_txid, status, created_at, updated_at, note")
    .eq("user_id", user.userId)
    .order("created_at", { ascending: false })
    .limit(20);

  const claimableTotal = (claimable ?? []).reduce((s, e) => s + parseFloat(String(e.earned_pi)), 0);
  const pendingTotal   = (pending ?? []).reduce((s, e) => s + parseFloat(String(e.earned_pi)), 0);

  // Earliest pending — show when it becomes claimable
  const earliestPending = pending?.length
    ? new Date(Math.min(...pending.map(e => new Date(e.created_at).getTime())))
    : null;
  const claimableDate = earliestPending
    ? new Date(earliestPending.getTime() + holdDays * 86400000)
    : null;

  return NextResponse.json({
    success: true,
    data: {
      claimable_pi:   Math.round(claimableTotal * 10000) / 10000,
      pending_pi:     Math.round(pendingTotal * 10000) / 10000,
      claimable_date: claimableDate,
      hold_days:      holdDays,
      history:        history ?? [],
      claimable_ids:  (claimable ?? []).map(e => e.id),
    },
  });
}

// POST /api/referral/withdraw — execute A2U withdrawal and mark as paid
export async function POST(req: Request) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { amount } = await req.json();
  if (!amount || amount <= 0) return NextResponse.json({ success: false, error: "Invalid amount" }, { status: 400 });
  if (!isOwnerTransferConfigured()) {
    return NextResponse.json({ success: false, error: "Pi payout not configured. Contact admin." }, { status: 503 });
  }

  const holdDays = await getConfig("referral_hold_days");
  const holdDate = new Date();
  holdDate.setDate(holdDate.getDate() - holdDays);

  // Get claimable earnings
  const { data: claimable } = await supabase
    .from("referral_earnings")
    .select("id, earned_pi")
    .eq("earner_id", user.userId)
    .eq("status", "pending")
    .lte("created_at", holdDate.toISOString());

  const claimableTotal = (claimable ?? []).reduce((s, e) => s + parseFloat(String(e.earned_pi)), 0);

  if (claimableTotal < amount - 0.0001) {
    return NextResponse.json({ success: false, error: "Insufficient claimable balance" }, { status: 400 });
  }
  // Keep payout accounting exact and avoid partial lock mismatch.
  if (Math.abs(claimableTotal - Number(amount)) > 0.0001) {
    return NextResponse.json({
      success: false,
      error: `Please withdraw full claimable amount (${claimableTotal.toFixed(4)}π).`,
    }, { status: 400 });
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("pi_uid, wallet_address, wallet_verified")
    .eq("id", user.userId)
    .single();
  const u = userRow as { pi_uid?: string; wallet_address?: string; wallet_verified?: boolean } | null;
  const recipientUid = u?.pi_uid?.trim();
  const destinationWallet = u?.wallet_address?.trim();
  const hasActivatedWallet = !!destinationWallet || !!u?.wallet_verified;
  if (!recipientUid || !hasActivatedWallet) {
    return NextResponse.json({
      success: false,
      error: "You must sign in with Pi and activate your wallet before withdrawing.",
    }, { status: 400 });
  }

  // Create withdrawal record
  const syntheticPaymentId = `a2u_ref_${Date.now()}_${user.userId.slice(0, 8)}`;
  const { data: withdrawal, error: wErr } = await supabase
    .from("referral_withdrawals")
    .insert({
      user_id:       user.userId,
      amount_pi:     amount,
      pi_payment_id: syntheticPaymentId,
      status:        "pending",
    })
    .select("id, amount_pi")
    .single();

  if (wErr || !withdrawal) return NextResponse.json({ success: false, error: "Failed to create withdrawal" }, { status: 500 });

  // Lock earnings — mark as "processing" with withdrawal_id
  const earningIds = (claimable ?? []).map(e => e.id);
  await supabase
    .from("referral_earnings")
    .update({ status: "processing", withdrawal_id: withdrawal.id })
    .in("id", earningIds);

  const transfer = await executeOwnerTransfer({
    amountPi: Number(withdrawal.amount_pi),
    recipientUid: recipientUid || undefined,
    destinationWallet: destinationWallet || undefined,
    note: `Referral withdrawal ${withdrawal.id}`,
  });

  if (!transfer.ok || !transfer.txid) {
    await supabase
      .from("referral_earnings")
      .update({ status: "pending", withdrawal_id: null })
      .eq("withdrawal_id", withdrawal.id);
    await supabase
      .from("referral_withdrawals")
      .update({ status: "failed", note: transfer.message ?? "A2U payout failed", updated_at: new Date().toISOString() })
      .eq("id", withdrawal.id);
    return NextResponse.json({ success: false, error: transfer.message ?? "A2U payout failed" }, { status: 502 });
  }

  await supabase.from("referral_withdrawals").update({
    status: "completed",
    pi_txid: transfer.txid,
    note: "A2U payout",
    updated_at: new Date().toISOString(),
  }).eq("id", withdrawal.id);

  await supabase.from("referral_earnings")
    .update({ status: "paid" })
    .eq("withdrawal_id", withdrawal.id);

  // Update stats
  const { data: stats } = await supabase
    .from("referral_stats").select("paid_pi, pending_pi").eq("user_id", user.userId).single();
  if (stats) {
    await supabase.from("referral_stats").update({
      paid_pi: parseFloat(String(stats.paid_pi)) + Number(withdrawal.amount_pi),
      pending_pi: Math.max(0, parseFloat(String(stats.pending_pi)) - Number(withdrawal.amount_pi)),
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.userId);
  }

  return NextResponse.json({
    success: true,
    data: { withdrawal_id: withdrawal.id, status: "completed", pi_txid: transfer.txid },
  });
}

// PATCH /api/referral/withdraw — legacy callback endpoint (deprecated)
export async function PATCH(req: Request) {
  await req.json().catch(() => ({}));
  return NextResponse.json({
    success: false,
    error: "Deprecated endpoint. Referral withdrawal now uses direct A2U payout via POST.",
  }, { status: 410 });
}