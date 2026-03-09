// app/api/payments/test-complete/route.ts
// TEMPORARY — for Step 10 Pi Developer Portal verification only
// No auth required

import { NextRequest } from "next/server";
import { completePayment } from "@/lib/pi/payments";
import * as R from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const { paymentId, txid } = await req.json();
    if (!paymentId || !txid) return R.badRequest("paymentId and txid required");

    console.log("[TestComplete] Completing:", paymentId, txid);

    const completed = await completePayment(paymentId, txid);
    if (!completed) return R.serverError("Failed to complete with Pi API");

    return R.ok({ paymentId, txid }, "Payment completed");
  } catch (err) {
    console.error("[TestComplete] Error:", err);
    return R.serverError();
  }
}