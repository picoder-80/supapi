// app/api/payments/approve/route.ts
// POST — Approve Pi payment (onReadyForServerApproval)

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

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return R.badRequest("Missing required fields");

  const { paymentId, type, referenceId, amountPi, memo } = parsed.data;
  const supabase = await createAdminClient();

  // Save pending transaction
  await supabase.from("transactions").insert({
    user_id:        payload.userId,
    type:           "purchase",
    amount_pi:      amountPi,
    pi_payment_id:  paymentId,
    reference_id:   referenceId,
    reference_type: type,
    status:         "pending",
    memo,
  });

  // Approve with Pi API
  const approved = await approvePayment(paymentId);
  if (!approved) return R.serverError("Failed to approve payment");

  return R.ok({ paymentId }, "Payment approved");
}
