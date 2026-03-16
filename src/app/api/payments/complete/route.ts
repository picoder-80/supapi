// src/app/api/payments/complete/route.ts
// POST — Complete Pi payment (onReadyForServerCompletion)
// CORS enabled for Pi Sandbox (sandbox.minepi.com).
//
// ESCROW MODEL:
// - Payment complete = Pi received in treasury = create escrow record (locked)
// - Commission split happens ONLY when buyer confirms received (order → completed)
// - Seller cannot withdraw until buyer confirms
//
// Fully idempotent — Pi SDK may call this multiple times

import { NextRequest } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth/session";
import { completePayment, getPayment } from "@/lib/pi/payments";
import { createAdminClient } from "@/lib/supabase/server";
import { processReferralReward } from "@/lib/referral";
import * as R from "@/lib/api";

const schema = z.object({
  paymentId: z.string().min(1),
  txid:      z.string().min(1),
});

const cors = (req: NextRequest) => req.headers.get("origin");

type TxRow = {
  id: string;
  status: string;
  user_id: string;
  amount_pi: number | null;
  metadata?: Record<string, unknown> | null;
  reference_id: string | null;
  reference_type: string | null;
};

async function fetchTransactionByPaymentId(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  paymentId: string
): Promise<TxRow | null> {
  const withMetadata = await supabase
    .from("transactions")
    .select("id, status, user_id, amount_pi, metadata, reference_id, reference_type")
    .eq("pi_payment_id", paymentId)
    .single();

  if (withMetadata.data) return withMetadata.data as TxRow;

  const code = (withMetadata.error as { code?: string } | null)?.code;
  if (code === "PGRST204") {
    const legacy = await supabase
      .from("transactions")
      .select("id, status, user_id, amount_pi, reference_id, reference_type")
      .eq("pi_payment_id", paymentId)
      .single();
    if (legacy.data) return { ...(legacy.data as TxRow), metadata: null };
  }

  return null;
}

async function recoverMissingTransaction(params: {
  paymentId: string;
  userId: string;
  supabase: Awaited<ReturnType<typeof createAdminClient>>;
}) {
  const piPayment = await getPayment(params.paymentId);
  const meta = (piPayment?.metadata ?? {}) as Record<string, unknown>;
  const rawOrderId = meta.order_id ?? meta.orderId ?? null;
  const orderId = typeof rawOrderId === "string" ? rawOrderId : null;
  const amountPi = Number(piPayment?.amount ?? 0);
  const memo = typeof piPayment?.memo === "string" ? piPayment.memo : "Supapi Market payment";

  if (!orderId || !amountPi || amountPi <= 0) {
    console.error("[Complete] Recovery failed: missing order_id/amount from Pi payment", params.paymentId, piPayment);
    return false;
  }

  const { error } = await params.supabase.from("transactions").upsert(
    {
      user_id: params.userId,
      type: "purchase",
      amount_pi: amountPi,
      pi_payment_id: params.paymentId,
      reference_id: orderId,
      reference_type: "listing",
      status: "pending",
      memo,
    },
    { onConflict: "pi_payment_id" }
  );

  if (error) {
    console.error("[Complete] Recovery upsert failed:", params.paymentId, error);
    return false;
  }

  console.log("[Complete] Recovered missing transaction from Pi API:", params.paymentId, orderId);
  return true;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: R.corsHeaders("*") });
}

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return R.withCors(R.unauthorized(), cors(req));

  const body   = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return R.withCors(R.badRequest("Missing required fields"), cors(req));

  const { paymentId, txid } = parsed.data;
  const supabase = await createAdminClient();

  // ── IDEMPOTENT check (with short retry to avoid approve/complete race) ──
  let transaction: TxRow | null = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const data = await fetchTransactionByPaymentId(supabase, paymentId);
    if (data) {
      transaction = data;
      break;
    }
    if (attempt < 5) await new Promise((r) => setTimeout(r, 400));
  }

  if (!transaction) {
    console.error("[Complete] Transaction not found:", paymentId);
    const recovered = await recoverMissingTransaction({
      paymentId,
      userId: payload.userId,
      supabase,
    });
    if (!recovered) {
      return R.withCors(R.badRequest("Transaction not found"), cors(req));
    }
    transaction = await fetchTransactionByPaymentId(supabase, paymentId);
    if (!transaction) {
      return R.withCors(R.badRequest("Transaction not found"), cors(req));
    }
  }

  if (transaction.user_id !== payload.userId) {
    console.error("[Complete] Transaction user mismatch:", paymentId, payload.userId, transaction.user_id);
    return R.withCors(R.forbidden("Payment does not belong to this user"), cors(req));
  }

  const alreadyCompletedTx = transaction.status === "completed";
  if (!alreadyCompletedTx) {
    // ── Complete with Pi API ────────────────────────────────────
    const completed = await completePayment(paymentId, txid);
    if (!completed) {
      // Idempotency fallback: Pi may already mark payment completed.
      const piPayment = await getPayment(paymentId);
      const alreadyCompleted = Boolean(piPayment?.status?.developer_completed);
      if (!alreadyCompleted) {
        return R.withCors(R.serverError("Failed to complete payment with Pi"), cors(req));
      }
    }

    // ── Update transaction ──────────────────────────────────────
    await supabase
      .from("transactions")
      .update({ status: "completed", txid })
      .eq("pi_payment_id", paymentId);
  } else {
    console.log("[Complete] Already completed transaction, running sync:", paymentId);
  }

  // ── Podcast tip: mark tip completed ──
  if (transaction.reference_type === "supapod_tip") {
    const tipId = transaction.reference_id;
    if (tipId) {
      await supabase
        .from("supapod_tips")
        .update({ status: "completed", pi_payment_id: paymentId })
        .eq("id", tipId);
      console.log("[Complete] Podcast tip completed:", tipId);
    }
  }

  // ── Create ESCROW record (locked — not yet released to seller) ──
  const meta = (transaction.metadata ?? {}) as Record<string, unknown>;
  const metaOrderId = typeof meta.order_id === "string" ? meta.order_id : null;
  const orderId = metaOrderId ?? (transaction.reference_type === "listing" ? transaction.reference_id : null);
  const platform = meta.platform ?? "market";
  const grossPi  = parseFloat(String(transaction.amount_pi ?? 0));

  if (orderId && grossPi > 0) {
    // Get commission % for this platform
    const { data: configData } = await supabase
      .from("platform_config")
      .select("value")
      .eq("key", `commission_${platform}`)
      .maybeSingle();

    const { data: fallback } = !configData ? await supabase
      .from("platform_config")
      .select("value")
      .eq("key", "market_commission_pct")
      .single() : { data: null };

    const commissionPct = parseFloat(configData?.value ?? fallback?.value ?? "5");
    const commissionPi  = Math.round(grossPi * (commissionPct / 100) * 1000000) / 1000000;
    const netPi         = Math.round((grossPi - commissionPi) * 1000000) / 1000000;

    // Get seller from order
    const { data: order } = await supabase
      .from("orders")
      .select("seller_id")
      .eq("id", orderId)
      .single();

    if (order?.seller_id) {
      // Create escrow — status "escrow" means Pi received but NOT released yet
      await supabase.from("seller_earnings").upsert({
        seller_id:      order.seller_id,
        order_id:       orderId,
        platform:       platform,
        gross_pi:       grossPi,
        commission_pct: commissionPct,
        commission_pi:  commissionPi,
        net_pi:         netPi,
        status:         "escrow", // locked until buyer confirms
      }, { onConflict: "order_id" });

      console.log(`[Complete] Escrow created — gross:${grossPi}π commission:${commissionPct}% net:${netPi}π seller:${order.seller_id}`);
    }

    // Always sync order as paid when payment is completed,
    // even if seller row fetch/upsert path had transient issues.
    await supabase.from("orders").update({
      commission_pct: commissionPct,
      commission_pi:  commissionPi,
      seller_net_pi:  netPi,
      status:         "paid",
      pi_payment_id:  paymentId,
    }).eq("id", orderId);
  }

  // ── Referral reward on first purchase ──────────────────────
  const { count } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", payload.userId)
    .eq("status", "completed");

  if (count === 1) {
    await processReferralReward(payload.userId);
  }

  return R.withCors(
    R.ok({ paymentId, txid }, alreadyCompletedTx ? "Payment already completed (synced)" : "Payment completed"),
    cors(req)
  );
}
