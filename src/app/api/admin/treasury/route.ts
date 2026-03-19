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
  // Prefer sum from treasury_owner_withdrawals (transaction history)
  const { data: rows } = await supabase
    .from("treasury_owner_withdrawals")
    .select("amount_pi");
  if (rows?.length) {
    const sum = (rows as { amount_pi: number }[]).reduce((s, r) => s + parseFloat(String(r.amount_pi ?? 0)), 0);
    return Math.round(sum * 10000) / 10000;
  }
  // Fallback: platform_config
  const { data } = await supabase
    .from("platform_config")
    .select("value")
    .eq("key", "treasury_owner_withdrawn_total_pi")
    .maybeSingle();
  return Number.parseFloat(String(data?.value ?? "0")) || 0;
}

async function setOwnerWithdrawnTotal(supabase: any, total: number): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("platform_config").upsert({
    key: "treasury_owner_withdrawn_total_pi",
    value: String(Math.max(0, total)),
    description: "Total owner treasury withdrawals (Pi)",
    updated_at: new Date().toISOString(),
  }, { onConflict: "key" });
  if (error) {
    console.error("[Treasury] setOwnerWithdrawnTotal failed:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
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

  // Admin user for auto-fill (owner withdrawing to self)
  let admin_user: { username: string; pi_uid: string } | null = null;
  if (auth.userId) {
    const { data: adminRow } = await supabase
      .from("users")
      .select("username, pi_uid")
      .eq("id", auth.userId)
      .not("pi_uid", "is", null)
      .single();
    if (adminRow?.pi_uid) {
      admin_user = { username: String(adminRow.username ?? ""), pi_uid: String(adminRow.pi_uid).trim() };
    }
  }

  const revenueQuery = supabase
    .from("admin_revenue")
    .select("platform, gross_pi, commission_pi, created_at, order_id");
  if (fromDate) revenueQuery.gte("created_at", fromDate);

  // Also fetch completed orders (SupaMarket) — fallback when admin_revenue missing
  const ordersQuery = supabase
    .from("orders")
    .select("id, amount_pi, price_pi, commission_pi, commission_pct, created_at")
    .eq("status", "completed");
  if (fromDate) ordersQuery.gte("created_at", fromDate);

  const [
    { data: revenue },
    { data: completedOrders },
    { data: pendingWithdrawals },
    { data: recentWithdrawals },
    { data: ownerWithdrawals },
    { data: configs },
    { data: platformLabels },
    { data: platformEmojis },
  ] = await Promise.all([
    revenueQuery,
    ordersQuery,

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

    // Owner withdrawal history (transaction history) — table may not exist before migration
    supabase.from("treasury_owner_withdrawals")
      .select("id, amount_pi, pi_txid, recipient_uid, admin_note, execute_transfer, created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .then((r) => (r.error ? { data: [] } : r)),

    // Commission configs — commission_% keys (values from platform_config, dynamic)
    supabase.from("platform_config")
      .select("key, value")
      .like("key", "commission_%"),
    supabase.from("platform_config")
      .select("key, value")
      .like("key", "platform_label_%"),
    supabase.from("platform_config")
      .select("key, value")
      .like("key", "platform_emoji_%"),
  ]);

  // Default commission % from config (market/supamarket)
  const defaultCommissionPct = (() => {
    const cfg = (configs ?? []).find((c: { key: string }) =>
      c.key === "commission_market" || c.key === "market_commission_pct"
    );
    const v = parseFloat(String(cfg?.value ?? "5"));
    return Number.isFinite(v) ? v : 5;
  })();

  // Aggregate by platform (admin_revenue)
  const platformBreakdown: Record<string, { gross: number; commission: number; count: number }> = {};
  const revenueOrderIds = new Set<string>();
  (revenue ?? []).forEach(r => {
    if (!platformBreakdown[r.platform]) {
      platformBreakdown[r.platform] = { gross: 0, commission: 0, count: 0 };
    }
    platformBreakdown[r.platform].gross      += parseFloat(String(r.gross_pi));
    platformBreakdown[r.platform].commission += parseFloat(String(r.commission_pi));
    platformBreakdown[r.platform].count      += 1;
    if (r.order_id) revenueOrderIds.add(String(r.order_id));
  });

  // Fallback: include commission from completed orders NOT in admin_revenue (e.g. SupaMarket)
  (completedOrders ?? []).forEach(o => {
    if (revenueOrderIds.has(String(o.id))) return;
    const gross = parseFloat(String(o.amount_pi ?? o.price_pi ?? 0));
    if (gross <= 0) return;
    const pct = parseFloat(String(o.commission_pct ?? defaultCommissionPct));
    const comm = parseFloat(String(o.commission_pi ?? 0)) || gross * (pct / 100);
    const platform = "market";
    if (!platformBreakdown[platform]) {
      platformBreakdown[platform] = { gross: 0, commission: 0, count: 0 };
    }
    platformBreakdown[platform].gross      += gross;
    platformBreakdown[platform].commission += comm;
    platformBreakdown[platform].count      += 1;
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
  (completedOrders ?? []).forEach(o => {
    if (revenueOrderIds.has(String(o.id))) return;
    const month = (o.created_at ?? "").slice(0, 7);
    if (!month) return;
    const gross = parseFloat(String(o.amount_pi ?? o.price_pi ?? 0));
    const c = parseFloat(String(o.commission_pi ?? 0));
    const comm = c > 0 ? c : gross * (parseFloat(String(o.commission_pct ?? defaultCommissionPct)) / 100);
    monthlyTrend[month] = (monthlyTrend[month] ?? 0) + comm;
  });

  // Build commission configs with dynamic label/emoji from platform_config
  const labelMap = Object.fromEntries((platformLabels ?? []).map((r: { key: string; value: string }) => [r.key.replace("platform_label_", ""), r.value]));
  const emojiMap = Object.fromEntries((platformEmojis ?? []).map((r: { key: string; value: string }) => [r.key.replace("platform_emoji_", ""), r.value]));
  const commissionConfigs = (configs ?? []).map((c: { key: string; value: string }) => {
    const platform = c.key.replace("commission_", "");
    return {
      key: c.key,
      value: c.value,
      platform,
      label: labelMap[platform] ?? platform.replace(/^([a-z])/, (_, m) => m.toUpperCase()),
      emoji: emojiMap[platform] ?? "🪐",
    };
  });

  // platform_display for Revenue by Platform (label/emoji from config)
  const platform_display: Record<string, { label: string; emoji: string }> = {};
  Object.keys(labelMap).forEach(p => {
    platform_display[p] = { label: labelMap[p], emoji: emojiMap[p] ?? "🪐" };
  });

  return NextResponse.json(
    {
      success: true,
      data: {
        period,
        admin_user,
        summary: {
        total_gross_pi:      Math.round(totalGross * 10000) / 10000,
        total_commission_pi: Math.round(totalCommission * 10000) / 10000,
        pending_payouts_pi:  Math.round(totalPendingPayout * 10000) / 10000,
        available_balance_pi: Math.round(availableBalance * 10000) / 10000,
        owner_withdrawn_pi: Math.round(ownerWithdrawnPi * 10000) / 10000,
        available_after_owner_pi: Math.round(availableAfterOwner * 10000) / 10000,
      },
      by_platform:        platformBreakdown,
      platform_display,
      monthly_trend:      monthlyTrend,
      pending_withdrawals: pendingWithdrawals ?? [],
      recent_withdrawals:  recentWithdrawals ?? [],
      owner_withdrawals:   ownerWithdrawals ?? [],
      commission_configs:  commissionConfigs,
    },
  },
  {
    headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" },
  }
);
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
  } = await req.json();

  if (!action)
    return NextResponse.json({ success: false, error: "Missing action" }, { status: 400 });

  if (action === "owner_withdraw") {
    const amount = Number.parseFloat(String(amount_pi ?? 0));
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: "Invalid amount_pi" }, { status: 400 });
    }

    // Security: only allow owner withdrawals to a single whitelisted Pi user.
    // Client-side restrictions are not sufficient; enforce here server-side.
    const ALLOWED_RECIPIENT_USERNAME = "wandy80";
    const { data: allowedRecipient, error: recipientErr } = await supabase
      .from("users")
      .select("pi_uid")
      .eq("username", ALLOWED_RECIPIENT_USERNAME)
      .not("pi_uid", "is", null)
      .maybeSingle();

    if (recipientErr) {
      return NextResponse.json({ success: false, error: "Failed to resolve recipient" }, { status: 500 });
    }
    const destinationWallet = String(allowedRecipient?.pi_uid ?? "").trim();
    if (!destinationWallet) {
      return NextResponse.json({ success: false, error: "Whitelisted recipient not configured (missing users.pi_uid)" }, { status: 500 });
    }

    const [{ data: revenue }, { data: completedOrders }, { data: pendingWithdrawals }, { data: commissionConfig }] = await Promise.all([
      supabase.from("admin_revenue").select("commission_pi, order_id"),
      supabase.from("orders").select("id, commission_pi, amount_pi, price_pi, commission_pct").eq("status", "completed"),
      supabase.from("seller_withdrawals").select("amount_pi").eq("status", "pending"),
      (async () => {
        const { data: m } = await supabase.from("platform_config").select("value").eq("key", "market_commission_pct").maybeSingle();
        if (m?.value) return { data: m };
        const { data: c } = await supabase.from("platform_config").select("value").eq("key", "commission_market").maybeSingle();
        return { data: c };
      })(),
    ]);
    const ownerDefaultPct = parseFloat(String(commissionConfig?.value ?? "5")) || 5;
    const revenueOrderIds = new Set((revenue ?? []).map((r: { order_id?: string }) => String(r.order_id ?? "")).filter(Boolean));
    let totalCommission = (revenue ?? []).reduce((s: number, r: any) => s + parseFloat(String(r.commission_pi ?? 0)), 0);
    (completedOrders ?? []).forEach((o: { id: string; commission_pi?: number; amount_pi?: number; price_pi?: number; commission_pct?: number }) => {
      if (revenueOrderIds.has(String(o.id))) return;
      const gross = parseFloat(String(o.amount_pi ?? o.price_pi ?? 0));
      const c = parseFloat(String(o.commission_pi ?? 0));
      totalCommission += c > 0 ? c : gross * (parseFloat(String(o.commission_pct ?? ownerDefaultPct)) / 100);
    });
    const totalPendingPayout = (pendingWithdrawals ?? []).reduce((s: number, w: any) => s + parseFloat(String(w.amount_pi ?? 0)), 0);
    const ownerWithdrawnPi = await getOwnerWithdrawnTotal(supabase);
    const availableAfterOwner = totalCommission - totalPendingPayout - ownerWithdrawnPi;

    if (amount > availableAfterOwner + 0.000001) {
      return NextResponse.json({
        success: false,
        error: `Amount exceeds available treasury balance (${availableAfterOwner.toFixed(4)} π)`,
      }, { status: 400 });
    }

    let finalTxid = "";
    let transferMeta: Record<string, unknown> = {
      mode: "execute_transfer",
      configured: isOwnerTransferConfigured(),
    };

    // Pi A2U requires recipient_uid (Pi user ID), not wallet address
    const transfer = await executeOwnerTransfer({
      amountPi: amount,
      recipientUid: destinationWallet,
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

    // 1. Update balance FIRST (critical — must succeed for stats to deduct)
    const updateResult = await setOwnerWithdrawnTotal(supabase, ownerWithdrawnPi + amount);
    if (!updateResult.ok) {
      return NextResponse.json({
        success: false,
        error: `Transfer succeeded but failed to update balance: ${updateResult.error}`,
        data: { transfer: transferMeta },
      }, { status: 500 });
    }

    // 2. Record in treasury_owner_withdrawals (transaction history — optional, table may not exist yet)
    const { error: insertErr } = await supabase.from("treasury_owner_withdrawals").insert({
      amount_pi: amount,
      pi_txid: finalTxid || null,
      recipient_uid: destinationWallet || null,
      admin_user_id: auth.userId || null,
      admin_note: admin_note || null,
      execute_transfer: true,
    });
    if (insertErr) {
      console.error("[Treasury] Failed to record owner withdrawal in history (table may not exist):", insertErr);
      // Don't fail — balance was already updated
    }

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
          execute_transfer: true,
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
      message: "Owner withdrawal executed and recorded",
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
