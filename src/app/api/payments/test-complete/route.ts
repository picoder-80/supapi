// app/api/payments/test-complete/route.ts
// TEMPORARY — for Step 10 Pi Developer Portal verification only
// No auth required. CORS enabled for Pi Sandbox (sandbox.minepi.com).

import { NextRequest } from "next/server";
import { completePayment } from "@/lib/pi/payments";
import * as R from "@/lib/api";

const cors = (req: NextRequest) => req.headers.get("origin");

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: R.corsHeaders("*"),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { paymentId, txid } = await req.json();
    if (!paymentId || !txid) return R.withCors(R.badRequest("paymentId and txid required"), cors(req));

    console.log("[TestComplete] Completing:", paymentId, txid);

    const completed = await completePayment(paymentId, txid);
    if (!completed) return R.withCors(R.serverError("Failed to complete with Pi API"), cors(req));

    return R.withCors(R.ok({ paymentId, txid }, "Payment completed"), cors(req));
  } catch (err) {
    console.error("[TestComplete] Error:", err);
    return R.withCors(R.serverError(), cors(req));
  }
}