// app/api/payments/complete/route.ts
// POST — Complete Pi payment (onReadyForServerCompletion)

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

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return R.badRequest("Missing required fields");

  const { paymentId, txid } = parsed.data;
  const supabase = await createAdminClient();

  // Complete with Pi API
  const completed = await completePayment(paymentId, txid);
  if (!completed) return R.serverError("Failed to complete payment");

  // Update transaction status
  const { data: transaction } = await supabase
    .from("transactions")
    .update({ status: "completed" })
    .eq("pi_payment_id", paymentId)
    .select()
    .single();

  // Check if this is user's first transaction — trigger referral reward
  const { count } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", payload.userId)
    .eq("status", "completed");

  if (count === 1) {
    await processReferralReward(payload.userId);
  }

  return R.ok({ transaction }, "Payment completed");
}
