// app/api/payments/complete/route.ts
// POST — Complete Pi payment (onReadyForServerCompletion)
//
// NOTE: Per SDK docs, onReadyForServerCompletion may be called multiple times
// (~every 10s) if the first attempt fails. Must be fully idempotent.

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

  // ✅ IDEMPOTENT — check current status first
  const { data: transaction } = await supabase
    .from("transactions")
    .select("id, status, user_id")
    .eq("pi_payment_id", paymentId)
    .single();

  if (!transaction) {
    // Transaction not found — possibly approve was never called
    console.error("[Complete] Transaction not found:", paymentId);
    return R.badRequest("Transaction not found");
  }

  if (transaction.status === "completed") {
    // Already completed — return success (idempotent)
    console.log("[Complete] Already completed:", paymentId);
    return R.ok({ paymentId, txid }, "Payment already completed");
  }

  // Complete with Pi API — ONLY update DB after Pi confirms
  const completed = await completePayment(paymentId, txid);
  if (!completed) return R.serverError("Failed to complete payment with Pi");

  // Update transaction status
  await supabase
    .from("transactions")
    .update({ status: "completed", txid })
    .eq("pi_payment_id", paymentId);

  // First completed transaction → trigger referral reward
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