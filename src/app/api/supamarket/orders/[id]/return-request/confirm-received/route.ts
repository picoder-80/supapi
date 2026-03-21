// POST — seller confirms returned item received, then escrow refund is executed
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";
import { refundMarketOrderEscrow } from "@/lib/market/refund-market-order";
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
    const { data: order } = await supabase.from("orders").select("id, seller_id, status").eq("id", orderId).single();
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

    const refund = await refundMarketOrderEscrow(supabase, orderId);
    if (!refund.ok) return withCors(NextResponse.json({ success: false, error: refund.error }, { status: 500 }), req);

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
    return withCors(NextResponse.json({ success: true, data: { order: orderRow, return_request_status: "refunded" } }), req);
  } catch {
    return withCors(NextResponse.json({ success: false }, { status: 500 }), req);
  }
}
