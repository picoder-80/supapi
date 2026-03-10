import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

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

// POST /api/referral/withdraw — initiate withdrawal, create Pi payment
export async function POST(req: Request) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { amount, pi_payment_id } = await req.json();
  if (!amount || amount <= 0) return NextResponse.json({ success: false, error: "Invalid amount" }, { status: 400 });
  if (!pi_payment_id) return NextResponse.json({ success: false, error: "Pi payment ID required" }, { status: 400 });

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

  // Create withdrawal record
  const { data: withdrawal, error: wErr } = await supabase
    .from("referral_withdrawals")
    .insert({
      user_id:       user.userId,
      amount_pi:     amount,
      pi_payment_id: pi_payment_id,
      status:        "pending",
    })
    .select("id")
    .single();

  if (wErr || !withdrawal) return NextResponse.json({ success: false, error: "Failed to create withdrawal" }, { status: 500 });

  // Lock earnings — mark as "processing" with withdrawal_id
  const earningIds = (claimable ?? []).map(e => e.id);
  await supabase
    .from("referral_earnings")
    .update({ status: "processing", withdrawal_id: withdrawal.id })
    .in("id", earningIds);

  return NextResponse.json({ success: true, data: { withdrawal_id: withdrawal.id } });
}

// PATCH /api/referral/withdraw — Pi SDK callbacks: complete or cancel
export async function PATCH(req: Request) {
  const { pi_payment_id, action, pi_txid } = await req.json();
  if (!pi_payment_id || !action) return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });

  // Verify Pi payment server-side
  const piRes = await fetch(`https://api.minepi.com/v2/payments/${pi_payment_id}`, {
    headers: { Authorization: `Key ${process.env.PI_API_KEY}` },
  });

  if (!piRes.ok) return NextResponse.json({ success: false, error: "Pi payment verification failed" }, { status: 400 });

  const piPayment = await piRes.json();

  // Find withdrawal
  const { data: withdrawal } = await supabase
    .from("referral_withdrawals")
    .select("id, user_id, amount_pi")
    .eq("pi_payment_id", pi_payment_id)
    .single();

  if (!withdrawal) return NextResponse.json({ success: false, error: "Withdrawal not found" }, { status: 404 });

  if (action === "complete") {
    // Verify amount matches
    if (Math.abs(piPayment.amount - parseFloat(String(withdrawal.amount_pi))) > 0.0001) {
      return NextResponse.json({ success: false, error: "Amount mismatch" }, { status: 400 });
    }

    // Complete the Pi payment via Pi API
    await fetch(`https://api.minepi.com/v2/payments/${pi_payment_id}/complete`, {
      method: "POST",
      headers: { Authorization: `Key ${process.env.PI_API_KEY}` },
    });

    // Update withdrawal
    await supabase.from("referral_withdrawals").update({
      status:     "completed",
      pi_txid:    pi_txid ?? piPayment.transaction?.txid,
      updated_at: new Date().toISOString(),
    }).eq("id", withdrawal.id);

    // Mark earnings as paid
    await supabase.from("referral_earnings")
      .update({ status: "paid" })
      .eq("withdrawal_id", withdrawal.id);

    // Update stats
    const { data: stats } = await supabase
      .from("referral_stats").select("paid_pi, pending_pi").eq("user_id", withdrawal.user_id).single();
    if (stats) {
      await supabase.from("referral_stats").update({
        paid_pi:    parseFloat(String(stats.paid_pi)) + parseFloat(String(withdrawal.amount_pi)),
        pending_pi: Math.max(0, parseFloat(String(stats.pending_pi)) - parseFloat(String(withdrawal.amount_pi))),
        updated_at: new Date().toISOString(),
      }).eq("user_id", withdrawal.user_id);
    }

    return NextResponse.json({ success: true, data: { status: "completed" } });
  }

  if (action === "cancel") {
    // Unlock earnings back to pending
    await supabase.from("referral_earnings")
      .update({ status: "pending", withdrawal_id: null })
      .eq("withdrawal_id", withdrawal.id);

    await supabase.from("referral_withdrawals").update({
      status:     "cancelled",
      updated_at: new Date().toISOString(),
    }).eq("id", withdrawal.id);

    return NextResponse.json({ success: true, data: { status: "cancelled" } });
  }

  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
}