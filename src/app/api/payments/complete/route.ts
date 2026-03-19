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
import { creditPlatformEarning } from "@/lib/wallet/earnings";
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

async function markOrderPaid(params: {
  supabase: Awaited<ReturnType<typeof createAdminClient>>;
  orderId: string;
  paymentId: string;
  userId: string;
  listingId?: string | null;
  commissionPct: number;
  commissionPi: number;
  netPi: number;
}) {
  const orderId = params.orderId.trim();

  const tryUpdateById = async (targetOrderId: string) => {
    const updatePaid = await params.supabase
      .from("orders")
      .update({
        commission_pct: params.commissionPct,
        commission_pi: params.commissionPi,
        seller_net_pi: params.netPi,
        status: "paid",
        pi_payment_id: params.paymentId,
      })
      .eq("id", targetOrderId)
      .select("id")
      .maybeSingle();

    if (updatePaid.data?.id) return true;
    if (!updatePaid.error) {
      console.warn("[Complete] Order paid sync affected 0 rows:", targetOrderId);
      return false;
    }

    const code = (updatePaid.error as { code?: string } | null)?.code;
    console.error("[Complete] Full order paid sync failed:", targetOrderId, updatePaid.error);

    // Compatibility fallback: some deployments still enforce "escrow" instead of "paid".
    if (code === "23514") {
      const updateEscrow = await params.supabase
        .from("orders")
        .update({
          commission_pct: params.commissionPct,
          commission_pi: params.commissionPi,
          seller_net_pi: params.netPi,
          status: "escrow",
          pi_payment_id: params.paymentId,
        })
        .eq("id", targetOrderId)
        .select("id")
        .maybeSingle();

      if (updateEscrow.data?.id) {
        console.log("[Complete] Escrow-status fallback sync succeeded:", targetOrderId);
        return true;
      }

      if (!updateEscrow.error) {
        console.warn("[Complete] Escrow-status fallback affected 0 rows:", targetOrderId);
      } else {
        console.error("[Complete] Escrow-status fallback failed:", targetOrderId, updateEscrow.error);
      }

      // Last compatibility fallback: keep status "pending" but attach payment_id + commission fields.
      // UI/API can derive effective paid state from pending + pi_payment_id.
      const updatePending = await params.supabase
        .from("orders")
        .update({
          commission_pct: params.commissionPct,
          commission_pi: params.commissionPi,
          seller_net_pi: params.netPi,
          status: "pending",
          pi_payment_id: params.paymentId,
        })
        .eq("id", targetOrderId)
        .select("id")
        .maybeSingle();

      if (updatePending.data?.id) {
        console.log("[Complete] Pending-status compatibility sync succeeded:", targetOrderId);
        return true;
      }

      if (!updatePending.error) {
        console.warn("[Complete] Pending-status compatibility sync affected 0 rows:", targetOrderId);
      } else {
        console.error("[Complete] Pending-status compatibility sync failed:", targetOrderId, updatePending.error);
      }
    }

    // Backward-compatible fallback for databases that do not yet have commission columns.
    if (code === "PGRST204") {
      const minimalUpdate = await params.supabase
        .from("orders")
        .update({
          status: "paid",
          pi_payment_id: params.paymentId,
        })
        .eq("id", targetOrderId)
        .select("id")
        .maybeSingle();

      if (minimalUpdate.data?.id) {
        console.log("[Complete] Fallback order paid sync succeeded:", targetOrderId);
        return true;
      }

      if (!minimalUpdate.error) {
        console.warn("[Complete] Fallback order paid sync affected 0 rows:", targetOrderId);
      } else {
        console.error("[Complete] Fallback order paid sync failed:", targetOrderId, minimalUpdate.error);
      }
      return false;
    }

    return false;
  };

  if (await tryUpdateById(orderId)) return true;

  // Secondary repair path: try to resolve by buyer + listing if direct order id update missed.
  if (params.listingId) {
    const fallbackOrder = await params.supabase
      .from("orders")
      .select("id, status, created_at")
      .eq("buyer_id", params.userId)
      .eq("listing_id", params.listingId)
      .in("status", ["pending", "escrow", "paid"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fallbackOrder.data?.id) {
      console.warn("[Complete] Using fallback order resolution:", {
        fromOrderId: orderId,
        toOrderId: fallbackOrder.data.id,
        listingId: params.listingId,
      });
      return tryUpdateById(String(fallbackOrder.data.id));
    }
  }

  return false;
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
      const { data: tip } = await supabase
        .from("supapod_tips")
        .select("id, amount_pi, episode_id")
        .eq("id", tipId)
        .maybeSingle();

      await supabase
        .from("supapod_tips")
        .update({ status: "completed", pi_payment_id: paymentId })
        .eq("id", tipId);

      if (tip?.episode_id) {
        const { data: episode } = await supabase
          .from("supapod_episodes")
          .select("supapod_id")
          .eq("id", tip.episode_id)
          .maybeSingle();
        if (episode?.supapod_id) {
          const { data: pod } = await supabase
            .from("supapods")
            .select("creator_id")
            .eq("id", episode.supapod_id)
            .maybeSingle();
          if (pod?.creator_id && Number(tip.amount_pi ?? 0) > 0) {
            await creditPlatformEarning({
              userId: String(pod.creator_id),
              platform: "supapod",
              event: "tip",
              amountPi: Number(tip.amount_pi),
              status: "available",
              refId: String(tip.id),
              note: `Tip received for podcast episode`,
            });
          }
        }
      }
      console.log("[Complete] Podcast tip completed:", tipId);
    }
  }

  // ── SupaScrow escrow: mark deal funded ──
  if (transaction.reference_type === "supascrow") {
    const dealId = transaction.reference_id;
    if (dealId) {
      const { data: deal } = await supabase
        .from("supascrow_deals")
        .select("id, buyer_id, status")
        .eq("id", dealId)
        .single();
      if (deal && deal.buyer_id === payload.userId && deal.status === "accepted") {
        await supabase
          .from("supascrow_deals")
          .update({ status: "funded", pi_payment_id: paymentId, updated_at: new Date().toISOString() })
          .eq("id", dealId);
        console.log("[Complete] SupaScrow deal funded:", dealId);
      }
    }
  }

  // ── Create ESCROW record (locked — not yet released to seller) ──
  const meta = (transaction.metadata ?? {}) as Record<string, unknown>;
  const metaOrderId = typeof meta.order_id === "string" ? meta.order_id.trim() : null;
  const metaListingId = typeof meta.listing_id === "string" ? meta.listing_id.trim() : null;
  const refOrderId =
    typeof transaction.reference_id === "string" ? transaction.reference_id.trim() : transaction.reference_id;
  const orderId = metaOrderId ?? (transaction.reference_type === "listing" ? refOrderId : null);
  // platform for commission lookup: from metadata or derive from reference_type
  const platform = meta.platform ?? (transaction.reference_type === "listing" ? "market" : "market");
  const grossPi  = parseFloat(String(transaction.amount_pi ?? 0));

  if (orderId && grossPi > 0) {
    // Get commission % from platform_config (never hardcode — use configured rate)
    const { data: cfg1 } = await supabase
      .from("platform_config")
      .select("value")
      .eq("key", `commission_${platform}`)
      .maybeSingle();
    const { data: cfg2 } = !cfg1?.value
      ? await supabase.from("platform_config").select("value").eq("key", "market_commission_pct").maybeSingle()
      : { data: null };
    const rawPct = String(cfg1?.value ?? cfg2?.value ?? "").trim();
    const commissionPct = Number.isFinite(parseFloat(rawPct)) ? parseFloat(rawPct) : 5;
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
    const paidSynced = await markOrderPaid({
      supabase,
      orderId,
      paymentId,
      userId: payload.userId,
      listingId: metaListingId,
      commissionPct,
      commissionPi,
      netPi,
    });
    if (!paidSynced) {
      console.error("[Complete] Unable to mark order as paid after fallback attempts:", { orderId, paymentId });
    }
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
