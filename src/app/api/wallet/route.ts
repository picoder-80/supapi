// src/app/api/wallet/route.ts
// GET  — all wallet data: Pi balance hint, SC wallet, earnings wallet
// POST — withdraw earnings, credit earnings

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { isAdminRole } from "@/lib/admin/roles";
import { creditEarningsBalance } from "@/lib/wallet/earnings";
import { executeOwnerTransfer, isOwnerTransferConfigured } from "@/lib/pi/payout";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getUserAuth(req: NextRequest): { userId: string; role: string } | null {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const userId = String(decoded.userId ?? decoded.id ?? decoded.sub ?? "");
    const role = String(decoded.role ?? "user");
    if (!userId) return null;
    return { userId, role };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const auth = getUserAuth(req);
  if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const userId = auth.userId;

  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("tab") ?? "sc";

  try {
    // Always fetch SC wallet — ✅ FIX: streak_days → checkin_streak
    const { data: scWallet } = await supabase
      .from("supapi_credits")
      .select("balance, total_earned, total_spent, checkin_streak, last_checkin")
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
          // ✅ FIX: streak_days → checkin_streak in fallback default
          scWallet: scWallet ?? { balance: 0, total_earned: 0, total_spent: 0, checkin_streak: 0, last_checkin: null },
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
          scWallet: scWallet ?? { balance: 0, total_earned: 0, total_spent: 0, checkin_streak: 0 },
          earningsWallet: earningsWallet ?? { pending_pi: 0, available_pi: 0, total_earned: 0, total_withdrawn: 0 },
          earningsTransactions: earnTxns ?? [],
          referrals: (referrals ?? []).map((r: any) => ({ ...r, referee: refereesMap[r.referee_id] })),
        }
      });
    }

    // Default / unknown tab
    return NextResponse.json({
      success: true,
      data: {
        scWallet: scWallet ?? { balance: 0, total_earned: 0, total_spent: 0, checkin_streak: 0, last_checkin: null },
        earningsWallet: earningsWallet ?? { pending_pi: 0, available_pi: 0, total_earned: 0, total_withdrawn: 0 },
      }
    });

  } catch (err: any) {
    console.error("[wallet GET]", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;
  const auth = getUserAuth(req);

  // ── Credit earnings (called from platform completions) ──
  if (action === "credit_earnings") {
    const internalKey = req.headers.get("x-internal-key") ?? "";
    const allowedInternal = process.env.INTERNAL_API_SECRET && internalKey === process.env.INTERNAL_API_SECRET;
    const allowedAdmin = isAdminRole(auth?.role);
    if (!allowedInternal && !allowedAdmin) {
      return NextResponse.json({ success: false, error: "Forbidden action" }, { status: 403 });
    }

    const { type, source, amount_pi, ref_id, note, status, target_user_id } = body;
    const recipientUserId = String(target_user_id ?? auth?.userId ?? "").trim();
    if (!recipientUserId) {
      return NextResponse.json({ success: false, error: "Missing target user" }, { status: 400 });
    }
    if (!amount_pi || parseFloat(amount_pi) <= 0) return NextResponse.json({ success: false, error: "Invalid amount" }, { status: 400 });

    const result = await creditEarningsBalance({
      userId: recipientUserId,
      type: String(type ?? "other"),
      source: String(source ?? "Wallet Credit"),
      amountPi: Number(amount_pi),
      status: (status ?? "pending") === "pending" ? "pending" : "available",
      refId: String(ref_id ?? ""),
      note: String(note ?? ""),
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: "Failed to credit earnings" }, { status: 500 });
    }
    return NextResponse.json({ success: true, duplicate_skipped: result.reason === "duplicate_skipped" });
  }

  if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const userId = auth.userId;

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
    const amt = Math.round((parseFloat(amount_pi) || 0) * 1000000) / 1000000;
    if (!amt || amt <= 0) return NextResponse.json({ success: false, error: "Invalid amount" }, { status: 400 });

    const { data: wallet } = await supabase.from("earnings_wallet")
      .select("available_pi, total_withdrawn").eq("user_id", userId).single();

    if (!wallet) return NextResponse.json({ success: false, error: "Wallet not found" }, { status: 404 });
    if (wallet.available_pi < amt) return NextResponse.json({ success: false, error: "Insufficient balance" }, { status: 400 });

    // Minimum withdrawal: π 1.0
    if (amt < 1) return NextResponse.json({ success: false, error: "Minimum withdrawal is π 1.0" }, { status: 400 });

    if (!isOwnerTransferConfigured()) {
      return NextResponse.json({ success: false, error: "Pi payout not configured. Contact admin." }, { status: 503 });
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("pi_uid, wallet_address, wallet_verified")
      .eq("id", userId)
      .single();
    const userWallet = userRow as { pi_uid?: string; wallet_address?: string; wallet_verified?: boolean } | null;
    const recipientUid = userWallet?.pi_uid?.trim();
    const destinationWallet = userWallet?.wallet_address?.trim();
    const hasActivatedWallet = !!destinationWallet || !!userWallet?.wallet_verified;
    if (!recipientUid || !hasActivatedWallet) {
      return NextResponse.json(
        { success: false, error: "You must sign in with Pi and activate your wallet before withdrawing." },
        { status: 400 }
      );
    }

    const payout = await executeOwnerTransfer({
      amountPi: amt,
      recipientUid: recipientUid || undefined,
      destinationWallet: destinationWallet || undefined,
      note: `Wallet withdrawal ${userId.slice(0, 8)} ${new Date().toISOString().slice(0, 19)}`,
    });
    if (!payout.ok || !payout.txid) {
      return NextResponse.json({ success: false, error: payout.message ?? "Withdrawal payout failed" }, { status: 502 });
    }

    const currentAvailable = Number(wallet.available_pi ?? 0);
    const currentWithdrawn = Number(wallet.total_withdrawn ?? 0);
    const nextAvailable = currentAvailable - amt;
    const nextWithdrawn = currentWithdrawn + amt;

    const { data: updatedWallet } = await supabase
      .from("earnings_wallet")
      .update({
        available_pi: nextAvailable,
        total_withdrawn: nextWithdrawn,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("available_pi", currentAvailable)
      .select("user_id")
      .maybeSingle();
    if (!updatedWallet?.user_id) {
      return NextResponse.json({
        success: false,
        error: "Withdrawal transfer sent, but wallet update conflicted. Contact support with payout txid.",
        txid: payout.txid,
      }, { status: 409 });
    }

    await supabase.from("earnings_transactions").insert({
      user_id: userId,
      type: "withdrawal",
      source: "Withdrawal to Pi Wallet",
      amount_pi: -amt,
      status: "withdrawn",
      note: `Withdrew π ${amt} to Pi Wallet · txid: ${payout.txid}`,
    });

    return NextResponse.json({ success: true, withdrawn: amt, txid: payout.txid });
  }

  return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
}
