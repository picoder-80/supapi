// app/api/payments/incomplete/route.ts
// Handle incomplete payments found during Pi.authenticate()
// Called by onIncompletePaymentFound callback

import { NextRequest } from "next/server";
import { z } from "zod";
import { completePayment, getPayment } from "@/lib/pi/payments";
import { createAdminClient } from "@/lib/supabase/server";
import * as R from "@/lib/api";

const schema = z.object({
  payment: z.object({
    identifier:  z.string(),
    transaction: z.object({
      txid:  z.string(),
      _link: z.string(),
    }).nullable().optional(),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return R.badRequest("Invalid payment data");

    const { payment } = parsed.data;
    const paymentId   = payment.identifier;
    const txid        = payment.transaction?.txid;

    console.log("[Incomplete] Found incomplete payment:", paymentId);

    const supabase = await createAdminClient();

    // Check if already in our DB
    const { data: existing } = await supabase
      .from("transactions")
      .select("*")
      .eq("pi_payment_id", paymentId)
      .single();

    // If transaction exists and has txid — complete it
    if (txid) {
      // Verify on Pi blockchain
      if (payment.transaction?._link) {
        try {
          const horizonRes  = await fetch(payment.transaction._link);
          const horizonData = await horizonRes.json();
          const memoOnChain = horizonData?.memo;

          if (memoOnChain && memoOnChain !== paymentId) {
            console.warn("[Incomplete] Payment ID mismatch on blockchain");
            return R.badRequest("Payment ID mismatch");
          }
        } catch (err) {
          console.warn("[Incomplete] Could not verify on blockchain:", err);
        }
      }

      // Complete with Pi API
      const completed = await completePayment(paymentId, txid);
      if (completed && existing) {
        await supabase
          .from("transactions")
          .update({ status: "completed" })
          .eq("pi_payment_id", paymentId);
      }

      return R.ok({ paymentId }, "Incomplete payment completed");
    }

    // No txid — payment was approved but user didn't confirm
    // Just log it, Pi will handle expiry
    console.log("[Incomplete] Payment has no txid yet:", paymentId);
    return R.ok({ paymentId }, "Incomplete payment acknowledged");

  } catch (err) {
    console.error("[Incomplete] Error:", err);
    return R.serverError();
  }
}