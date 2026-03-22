// POST — seller confirms returned item received, then escrow refund is executed
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";
import { refundMarketOrderEscrow } from "@/lib/market/refund-market-order";
import { issueBuyerRefundFromTreasury } from "@/lib/pi/refund";
import * as R from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

const cors = (req: NextRequest) => req.headers.get("origin");
const withCors = (res: NextResponse, req: NextRequest) => R.withCors(res, cors(req));

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: R.corsHeaders("*") });
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: orderId } = await params;
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return withCors(NextResponse.json({ success: false }, { status: 401 }), req);
    const payload = verifyToken(auth);
    if (!payload) return withCors(NextResponse.json({ success: false }, { status: 401 }), req);

    const body = await req.json().catch(() => ({}));
    const note = String(body?.note ?? "").trim().slice(0, 1000);

    const supabase = await createAdminClient();
    const { data: order } = await supabase
      .from("orders")
      .select("id, seller_id, buyer_id, amount_pi, status")
      .eq("id", orderId)
      .single();
    if (!order) return withCors(NextResponse.json({ success: false, error: "Order not found" }, { status: 404 }), req);
    if (order.seller_id !== payload.userId) {
      return withCors(NextResponse.json({ success: false, error: "Only seller can confirm return receipt" }, { status: 403 }), req);
    }

    const { data: rr } = await supabase
      .from("market_return_requests")
      .select("id, status")
      .eq("order_id", orderId)
      .eq("status", "buyer_return_shipped")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!rr) {
      return withCors(NextResponse.json({ success: false, error: "No buyer return shipment to confirm" }, { status: 400 }), req);
    }

    const { data: escrowRow } = await supabase
      .from("seller_earnings")
      .select("id")
      .eq("order_id", orderId)
      .eq("status", "escrow")
      .maybeSingle();
    if (!escrowRow) {
      return withCors(
        NextResponse.json({ success: false, error: "No escrow held for this order (already released or refunded)." }, { status: 400 }),
        req
      );
    }

    const amountPi = Number((order as { amount_pi?: number }).amount_pi ?? 0);
    if (!Number.isFinite(amountPi) || amountPi <= 0) {
      return withCors(NextResponse.json({ success: false, error: "Invalid order amount for refund" }, { status: 400 }), req);
    }

    const buyerId = String((order as { buyer_id?: string }).buyer_id ?? "");
    const { data: buyer } = await supabase.from("users").select("pi_uid").eq("id", buyerId).maybeSingle();
    const buyerUid = String(buyer?.pi_uid ?? "").trim();
    if (!buyerUid) {
      return withCors(
        NextResponse.json({ success: false, error: "Buyer Pi wallet not linked. Refund cannot be sent." }, { status: 400 }),
        req
      );
    }

    let payout: { paymentId: string; txid: string | null };
    try {
      payout = await issueBuyerRefundFromTreasury({
        buyerUid,
        amountPi,
        memo: `SupaMarket return refund order ${orderId.slice(0, 8)}`,
        metadata: { order_id: orderId, reason: "return_refund" },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Refund transfer failed";
      const isConfig =
        msg.includes("not configured") ||
        msg.includes("PI_PAYOUT") ||
        msg.includes("PI_TREASURY") ||
        msg.includes("PI_API_KEY");
      return withCors(
        NextResponse.json(
          {
            success: false,
            error: isConfig
              ? "Pi payout not configured. Set PI_PAYOUT_API_URL and PI_PAYOUT_API_KEY (or treasury settings for direct Pi API)."
              : msg,
          },
          { status: isConfig ? 503 : 502 }
        ),
        req
      );
    }

    const refund = await refundMarketOrderEscrow(supabase, orderId);
    if (!refund.ok) {
      console.error("[Return refund] DB escrow update failed after Pi payout:", refund.error, { orderId, txid: payout.txid });
      return withCors(NextResponse.json({ success: false, error: refund.error ?? "Escrow update failed after payout" }, { status: 500 }), req);
    }

    await supabase
      .from("transactions")
      .update({ status: "refunded" })
      .eq("reference_id", orderId)
      .eq("status", "completed");

    const now = new Date().toISOString();
    const { error: upErr } = await supabase
      .from("market_return_requests")
      .update({
        status: "refunded",
        seller_note: note || null,
        seller_confirmed_return_at: now,
        updated_at: now,
      })
      .eq("id", rr.id);
    if (upErr) return withCors(NextResponse.json({ success: false, error: upErr.message }, { status: 500 }), req);

    const { data: orderRow } = await supabase.from("orders").select("*").eq("id", orderId).single();
    return withCors(
      NextResponse.json({
        success: true,
        data: {
          order: orderRow,
          return_request_status: "refunded",
          refund: { amount_pi: amountPi, txid: payout.txid ?? payout.paymentId, payment_id: payout.paymentId },
        },
      }),
      req
    );
  } catch {
    return withCors(NextResponse.json({ success: false }, { status: 500 }), req);
  }
}
