// app/api/payments/test-approve/route.ts
// TEMPORARY — for Step 10 Pi Developer Portal verification only
// No auth required. CORS enabled for Pi Sandbox (sandbox.minepi.com).

import { NextRequest } from "next/server";
import { approvePayment } from "@/lib/pi/payments";
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
    const { paymentId } = await req.json();
    if (!paymentId) return R.withCors(R.badRequest("paymentId required"), cors(req));

    console.log("[TestApprove] Approving:", paymentId);

    const approved = await approvePayment(paymentId);
    if (!approved) return R.withCors(R.serverError("Failed to approve with Pi API"), cors(req));

    return R.withCors(R.ok({ paymentId }, "Payment approved"), cors(req));
  } catch (err) {
    console.error("[TestApprove] Error:", err);
    return R.withCors(R.serverError(), cors(req));
  }
}