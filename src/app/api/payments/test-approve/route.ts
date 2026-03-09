// app/api/payments/test-approve/route.ts
// TEMPORARY — for Step 10 Pi Developer Portal verification only
// No auth required

import { NextRequest } from "next/server";
import { approvePayment } from "@/lib/pi/payments";
import * as R from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const { paymentId } = await req.json();
    if (!paymentId) return R.badRequest("paymentId required");

    console.log("[TestApprove] Approving:", paymentId);

    const approved = await approvePayment(paymentId);
    if (!approved) return R.serverError("Failed to approve with Pi API");

    return R.ok({ paymentId }, "Payment approved");
  } catch (err) {
    console.error("[TestApprove] Error:", err);
    return R.serverError();
  }
}