// src/app/api/payments/complete/route.ts
// POST — Complete Pi payment (onReadyForServerCompletion)
// 
// ESCROW MODEL:
// - Payment complete = Pi received in treasury = create escrow record (locked)
// - Commission split happens ONLY when buyer confirms received (order → completed)
// - Seller cannot withdraw until buyer confirms
//
// Fully idempotent — Pi SDK may call this multiple times

import { NextRequest } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth/session";
import { completePayment } from "@/lib/pi/payments";
import { createAdminClient } from "@/lib/supabase/server";
import { processReferralReward } from "@/lib/referral";
import * as R from "@/lib/api";

const schema = z.object({
  paymentId: z.string().min(1),
  txid:      z.string().min(1),
});

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return R.unauthorized();

  const body   = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return R.badRequest("Missing required fields");

  const { paymentId, txid } = parsed.data;
  const supabase = await createAdminClient();

  // ── IDEMPOTENT check ───────────────────────────────────────
  const { data: transaction } = await supabase
    .from("transactions")
    .select("id, status, user_id, amount_pi, metadata")
    .eq("pi_payment_id", paymentId)
    .single();

  if (!transaction) {
    console.error("[Complete] Transaction not found:", paymentId);
    return R.badRequest("Transaction not found");
  }

  if (transaction.status === "completed") {
    console.log("[Complete] Already completed:", paymentId);
    return R.ok({ paymentId, txid }, "Payment already completed");
  }

  // ── Complete with Pi API ────────────────────────────────────
  const completed = await completePayment(paymentId, txid);
  if (!completed) return R.serverError("Failed to complete payment with Pi");

  // ── Update transaction ──────────────────────────────────────
  await supabase
    .from("transactions")
    .update({ status: "completed", txid })
    .eq("pi_payment_id", paymentId);

  // ── Create ESCROW record (locked — not yet released to seller) ──
  const meta    = transaction.metadata ?? {};
  const orderId = meta.order_id ?? null;
  const platform = meta.platform ?? "market";
  const grossPi  = parseFloat(String(transaction.amount_pi ?? 0));

  if (orderId && grossPi > 0) {
    // Get commission % for this platform
    const { data: configData } = await supabase
      .from("platform_config")
      .select("value")
      .eq("key", `commission_${platform}`)
      .maybeSingle();

    const { data: fallback } = !configData ? await supabase
      .from("platform_config")
      .select("value")
      .eq("key", "market_commission_pct")
      .single() : { data: null };

    const commissionPct = parseFloat(configData?.value ?? fallback?.value ?? "5");
    const commissionPi  = Math.round(grossPi * (commissionPct / 100) * 1000000) / 1000000;
    const netPi         = Math.round((grossPi - commissionPi) * 1000000) / 1000000;

    // Get seller from order
    const { data: order } = await supabase
      .from("orders")
      .select("seller_id")
      .eq("id", orderId)
      .single();

    if (order?.seller_id) {
      // Create escrow — status "escrow" means Pi received but NOT released yet
      await supabase.from("seller_earnings").upsert({
        seller_id:      order.seller_id,
        order_id:       orderId,
        platform:       platform,
        gross_pi:       grossPi,
        commission_pct: commissionPct,
        commission_pi:  commissionPi,
        net_pi:         netPi,
        status:         "escrow", // locked until buyer confirms
      }, { onConflict: "order_id" });

      // Update order with commission breakdown + mark as paid
      await supabase.from("orders").update({
        commission_pct: commissionPct,
        commission_pi:  commissionPi,
        seller_net_pi:  netPi,
        status:         "paid",
        pi_payment_id:  paymentId,
      }).eq("id", orderId);

      console.log(`[Complete] Escrow created — gross:${grossPi}π commission:${commissionPct}% net:${netPi}π seller:${order.seller_id}`);
    }
  }

  // ── Referral reward on first purchase ──────────────────────
  const { count } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", payload.userId)
    .eq("status", "completed");

  if (count === 1) {
    await processReferralReward(payload.userId);
  }

  return R.ok({ paymentId, txid }, "Payment completed");
}
