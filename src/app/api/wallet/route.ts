// src/app/api/wallet/route.ts
// GET  — all wallet data: Pi balance hint, SC wallet, earnings wallet
// POST — withdraw earnings, credit earnings

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getUserId(req: NextRequest): string | null {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return String(decoded.userId ?? decoded.id ?? decoded.sub ?? "");
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("tab") ?? "sc";

  try {
    // Always fetch SC wallet
    const { data: scWallet } = await supabase
      .from("supapi_credits")
      .select("balance, total_earned, total_spent, streak_days, last_checkin")
      .eq("user_id", userId).maybeSingle();

    // Earnings wallet
    await supabase.from("earnings_wallet")
      .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
    const { data: earningsWallet } = await supabase
      .from("earnings_wallet")
      .select("pending_pi, available_pi, total_earned, total_withdrawn")
      .eq("user_id", userId).maybeSingle();

    if (tab === "sc") {
      const { data: scTxns } = await supabase
        .from("credit_transactions")
        .select("id, type, activity, amount, balance_after, note, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);

      return NextResponse.json({
        success: true,
        data: {
          scWallet: scWallet ?? { balance: 0, total_earned: 0, total_spent: 0, streak_days: 0, last_checkin: null },
          earningsWallet: earningsWallet ?? { pending_pi: 0, available_pi: 0, total_earned: 0, total_withdrawn: 0 },
          scTransactions: scTxns ?? [],
        }
      });
    }

    if (tab === "earnings") {
      const { data: earnTxns } = await supabase
        .from("earnings_transactions")
        .select("id, type, source, amount_pi, status, note, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);

      // Referral stats
      const { data: referrals } = await supabase
        .from("referral_records")
        .select("id, referee_id, status, bonus_paid_pi, created_at")
        .eq("referrer_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      const refereeIds = (referrals ?? []).map((r: any) => r.referee_id);
      let refereesMap: Record<string, any> = {};
      if (refereeIds.length > 0) {
        const { data: referees } = await supabase
          .from("users").select("id, username, avatar_url, kyc_status").in("id", refereeIds);
        (referees ?? []).forEach((u: any) => { refereesMap[u.id] = u; });
      }

      return NextResponse.json({
        success: true,
        data: {
          scWallet: scWallet ?? { balance: 0, total_earned: 0, total_spent: 0 },
          earningsWallet: earningsWallet ?? { pending_pi: 0, available_pi: 0, total_earned: 0, total_withdrawn: 0 },
          earningsTransactions: earnTxns ?? [],
          referrals: (referrals ?? []).map((r: any) => ({ ...r, referee: refereesMap[r.referee_id] })),
        }
      });
    }

    // Pi tab — return just overview
    const { data: recentPiActivity } = await supabase
      .from("earnings_transactions")
      .select("id, type, source, amount_pi, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      data: {
        scWallet: scWallet ?? { balance: 0, total_earned: 0, total_spent: 0 },
        earningsWallet: earningsWallet ?? { pending_pi: 0, available_pi: 0, total_earned: 0, total_withdrawn: 0 },
        recentPiActivity: recentPiActivity ?? [],
      }
    });

  } catch (err: any) {
    console.error("[wallet GET]", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  // ── Credit earnings (called from platform completions) ──
  if (action === "credit_earnings") {
    const { type, source, amount_pi, ref_id, note, status } = body;
    if (!amount_pi || parseFloat(amount_pi) <= 0) return NextResponse.json({ success: false, error: "Invalid amount" }, { status: 400 });

    await supabase.from("earnings_wallet").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

    const { data: wallet } = await supabase.from("earnings_wallet")
      .select("pending_pi, available_pi, total_earned").eq("user_id", userId).single();

    if (!wallet) return NextResponse.json({ success: false, error: "Wallet not found" }, { status: 404 });

    const amt = parseFloat(amount_pi);
    const isPending = (status ?? "pending") === "pending";

    await supabase.from("earnings_wallet").update({
      pending_pi:   isPending ? wallet.pending_pi + amt : wallet.pending_pi,
      available_pi: isPending ? wallet.available_pi : wallet.available_pi + amt,
      total_earned: wallet.total_earned + amt,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);

    await supabase.from("earnings_transactions").insert({
      user_id: userId, type, source, amount_pi: amt,
      status: status ?? "pending",
      ref_id: ref_id ?? "", note: note ?? "",
    });

    return NextResponse.json({ success: true });
  }

  // ── Release pending to available ──
  if (action === "release_earnings") {
    const { transaction_id } = body;

    const { data: txn } = await supabase.from("earnings_transactions")
      .select("amount_pi, status, user_id").eq("id", transaction_id).single();

    if (!txn || txn.user_id !== userId) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    if (txn.status !== "pending") return NextResponse.json({ success: false, error: "Already released" }, { status: 400 });

    const { data: wallet } = await supabase.from("earnings_wallet")
      .select("pending_pi, available_pi").eq("user_id", userId).single();
    if (!wallet) return NextResponse.json({ success: false, error: "Wallet not found" }, { status: 404 });

    const amt = parseFloat(txn.amount_pi);
    await supabase.from("earnings_wallet").update({
      pending_pi:   Math.max(0, wallet.pending_pi - amt),
      available_pi: wallet.available_pi + amt,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);

    await supabase.from("earnings_transactions").update({ status: "available" }).eq("id", transaction_id);

    return NextResponse.json({ success: true });
  }

  // ── Withdraw to Pi wallet ──
  if (action === "withdraw") {
    const { amount_pi } = body;
    const amt = parseFloat(amount_pi);
    if (!amt || amt <= 0) return NextResponse.json({ success: false, error: "Invalid amount" }, { status: 400 });

    const { data: wallet } = await supabase.from("earnings_wallet")
      .select("available_pi, total_withdrawn").eq("user_id", userId).single();

    if (!wallet) return NextResponse.json({ success: false, error: "Wallet not found" }, { status: 404 });
    if (wallet.available_pi < amt) return NextResponse.json({ success: false, error: "Insufficient balance" }, { status: 400 });

    // Minimum withdrawal: π 1.0
    if (amt < 1) return NextResponse.json({ success: false, error: "Minimum withdrawal is π 1.0" }, { status: 400 });

    await supabase.from("earnings_wallet").update({
      available_pi:    wallet.available_pi - amt,
      total_withdrawn: wallet.total_withdrawn + amt,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);

    await supabase.from("earnings_transactions").insert({
      user_id: userId,
      type: "withdrawal",
      source: "Withdrawal to Pi Wallet",
      amount_pi: -amt,
      status: "withdrawn",
      note: `Withdrew π ${amt} to Pi Wallet`,
    });

    return NextResponse.json({ success: true, withdrawn: amt });
  }

  return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
}
