// src/app/api/admin/treasury/route.ts
// GET  — full treasury overview (revenue, commission, pending payouts)
// POST — process seller withdrawal or owner withdrawal record

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { logAdminAction } from "@/lib/security/audit";
import { executeOwnerTransfer, isOwnerTransferConfigured } from "@/lib/pi/payout";

async function getOwnerWithdrawnTotal(supabase: any): Promise<number> {
  const { data } = await supabase
    .from("platform_config")
    .select("value")
    .eq("key", "treasury_owner_withdrawn_total_pi")
    .maybeSingle();
  return Number.parseFloat(String(data?.value ?? "0")) || 0;
}

async function setOwnerWithdrawnTotal(supabase: any, total: number) {
  await supabase.from("platform_config").upsert({
    key: "treasury_owner_withdrawn_total_pi",
    value: String(Math.max(0, total)),
    description: "Total owner treasury withdrawals (Pi)",
  }, { onConflict: "key" });
}

// GET /api/admin/treasury
export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.treasury.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

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
  const ownerWithdrawnPi = await getOwnerWithdrawnTotal(supabase);
  const availableBalance = totalCommission - totalPendingPayout; // before owner withdrawals
  const availableAfterOwner = availableBalance - ownerWithdrawnPi;

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
        owner_withdrawn_pi: Math.round(ownerWithdrawnPi * 10000) / 10000,
        available_after_owner_pi: Math.round(availableAfterOwner * 10000) / 10000,
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
  if (!hasAdminPermission(auth.role, "admin.treasury.write")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createAdminClient();
  const {
    withdrawal_id,
    action,
    pi_txid,
    admin_note,
    amount_pi,
    execute_transfer,
    destination_wallet,
  } = await req.json();

  if (!action)
    return NextResponse.json({ success: false, error: "Missing action" }, { status: 400 });

  if (action === "owner_withdraw") {
    const amount = Number.parseFloat(String(amount_pi ?? 0));
    const executeTransfer = Boolean(execute_transfer);
    const destinationWallet = String(destination_wallet ?? "").trim();
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: "Invalid amount_pi" }, { status: 400 });
    }
    if (executeTransfer && !destinationWallet) {
      return NextResponse.json({ success: false, error: "destination_wallet required when execute_transfer=true" }, { status: 400 });
    }

    const [{ data: revenue }, { data: pendingWithdrawals }] = await Promise.all([
      supabase.from("admin_revenue").select("commission_pi"),
      supabase.from("seller_withdrawals").select("amount_pi").eq("status", "pending"),
    ]);
    const totalCommission = (revenue ?? []).reduce((s: number, r: any) => s + parseFloat(String(r.commission_pi ?? 0)), 0);
    const totalPendingPayout = (pendingWithdrawals ?? []).reduce((s: number, w: any) => s + parseFloat(String(w.amount_pi ?? 0)), 0);
    const ownerWithdrawnPi = await getOwnerWithdrawnTotal(supabase);
    const availableAfterOwner = totalCommission - totalPendingPayout - ownerWithdrawnPi;

    if (amount > availableAfterOwner + 0.000001) {
      return NextResponse.json({
        success: false,
        error: `Amount exceeds available treasury balance (${availableAfterOwner.toFixed(4)} π)`,
      }, { status: 400 });
    }

    let finalTxid = String(pi_txid ?? "").trim();
    let transferMeta: Record<string, unknown> = {
      mode: "record_only",
      configured: isOwnerTransferConfigured(),
    };

    if (executeTransfer) {
      const transfer = await executeOwnerTransfer({
        amountPi: amount,
        destinationWallet,
        note: admin_note ?? null,
      });
      transferMeta = {
        mode: "execute_transfer",
        provider: transfer.provider,
        configured: isOwnerTransferConfigured(),
      };
      if (!transfer.ok) {
        return NextResponse.json({
          success: false,
          error: transfer.message ?? "Transfer execution failed",
          data: { transfer: transferMeta, provider_response: transfer.raw ?? null },
        }, { status: transfer.provider === "unconfigured" ? 501 : 502 });
      }
      finalTxid = String(transfer.txid ?? "").trim();
    } else if (!finalTxid) {
      return NextResponse.json({ success: false, error: "pi_txid required for record-only mode" }, { status: 400 });
    }

    await setOwnerWithdrawnTotal(supabase, ownerWithdrawnPi + amount);

    if (auth.userId) {
      await logAdminAction({
        adminUserId: auth.userId,
        action: "treasury_owner_withdraw",
        targetType: "treasury",
        targetId: "owner",
        detail: {
          amount_pi: amount,
          pi_txid: finalTxid,
          note: admin_note ?? null,
          execute_transfer: executeTransfer,
          destination_wallet: destinationWallet || null,
          transfer: transferMeta,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        status: "recorded",
        amount_pi: amount,
        pi_txid: finalTxid,
        owner_withdrawn_total_pi: Number((ownerWithdrawnPi + amount).toFixed(4)),
        transfer: transferMeta,
      },
      message: executeTransfer ? "Owner withdrawal executed and recorded" : "Owner withdrawal recorded",
    });
  }

  if (!withdrawal_id)
    return NextResponse.json({ success: false, error: "Missing withdrawal_id" }, { status: 400 });

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

    if (auth.userId) {
      await logAdminAction({
        adminUserId: auth.userId,
        action: "treasury_seller_withdrawal_pay",
        targetType: "withdrawal",
        targetId: String(withdrawal_id),
        detail: { amount_pi: withdrawal.amount_pi, pi_txid: String(pi_txid) },
      });
    }

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

    if (auth.userId) {
      await logAdminAction({
        adminUserId: auth.userId,
        action: "treasury_seller_withdrawal_reject",
        targetType: "withdrawal",
        targetId: String(withdrawal_id),
        detail: { amount_pi: withdrawal.amount_pi, note: admin_note ?? null },
      });
    }

    console.log(`[Treasury] Withdrawal REJECTED: ${withdrawal_id}`);

    return NextResponse.json({
      success: true,
      data: { status: "rejected", withdrawal_id },
    });
  }

  return NextResponse.json({ success: false, error: "Invalid action. Use: pay | reject | owner_withdraw" }, { status: 400 });
}
