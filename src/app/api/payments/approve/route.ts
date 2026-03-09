// app/api/payments/approve/route.ts
// POST — Approve Pi payment (onReadyForServerApproval)
//
// NOTE: Per SDK docs, onReadyForServerApproval may be called multiple times
// (~every 10s) if the first attempt fails. Must be fully idempotent.

import { NextRequest } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth/session";
import { approvePayment } from "@/lib/pi/payments";
import { createAdminClient } from "@/lib/supabase/server";
import * as R from "@/lib/api";

const schema = z.object({
  paymentId:   z.string().min(1),
  type:        z.enum(["listing", "gig", "course", "stay", "game"]),
  referenceId: z.string().min(1),
  amountPi:    z.number().positive(),
  memo:        z.string(),
});

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return R.unauthorized();

  const body   = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return R.badRequest("Missing required fields");

  const { paymentId, type, referenceId, amountPi, memo } = parsed.data;
  const supabase = await createAdminClient();

  // ✅ IDEMPOTENT — check if already exists before inserting
  const { data: existing } = await supabase
    .from("transactions")
    .select("id, status")
    .eq("pi_payment_id", paymentId)
    .single();

  if (existing) {
    // Already approved before — just re-call Pi API (also idempotent)
    console.log("[Approve] Already exists, re-approving:", paymentId);
  } else {
    // First time — create the transaction record
    const { error } = await supabase.from("transactions").insert({
      user_id:        payload.userId,
      type:           "purchase",
      amount_pi:      amountPi,
      pi_payment_id:  paymentId,
      reference_id:   referenceId,
      reference_type: type,
      status:         "pending",
      memo,
    });

    if (error) {
      console.error("[Approve] Insert failed:", error);
      return R.serverError("Failed to record transaction");
    }
  }

  // Approve with Pi API — safe to call multiple times
  const approved = await approvePayment(paymentId);
  if (!approved) return R.serverError("Failed to approve payment with Pi");

  return R.ok({ paymentId }, "Payment approved");
}