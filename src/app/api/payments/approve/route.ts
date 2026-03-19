// app/api/payments/approve/route.ts
// POST — Approve Pi payment (onReadyForServerApproval)
// CORS enabled for Pi Sandbox (sandbox.minepi.com).
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
  type:        z.enum(["listing", "gig", "course", "stay", "game", "supapod_tip", "supascrow"]),
  referenceId: z.string().min(1),
  amountPi:    z.number().positive(),
  memo:        z.string(),
  metadata:    z.record(z.unknown()).optional(),
});

const cors = (req: NextRequest) => req.headers.get("origin");

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: R.corsHeaders("*") });
}

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return R.withCors(R.unauthorized(), cors(req));

  const body   = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return R.withCors(R.badRequest("Missing required fields"), cors(req));

  const { paymentId, type, referenceId, amountPi, memo, metadata } = parsed.data;
  const supabase = await createAdminClient();
  console.log("[Approve] Start:", { paymentId, userId: payload.userId, type, referenceId, amountPi });

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
    // First time — create the transaction record (metadata for commission platform lookup)
    const { error } = await supabase.from("transactions").insert({
      user_id:        payload.userId,
      type:           "purchase",
      amount_pi:      amountPi,
      pi_payment_id:  paymentId,
      reference_id:   referenceId,
      reference_type: type,
      status:         "pending",
      memo,
      metadata:       metadata ?? {},
    });

    if (error) {
      console.error("[Approve] Insert failed:", error);
      return R.withCors(R.serverError("Failed to record transaction"), cors(req));
    }
    console.log("[Approve] Transaction inserted:", paymentId);
  }

  // Approve with Pi API — safe to call multiple times
  const approved = await approvePayment(paymentId);
  if (!approved) return R.withCors(R.serverError("Failed to approve payment with Pi"), cors(req));

  return R.withCors(R.ok({ paymentId }, "Payment approved"), cors(req));
}