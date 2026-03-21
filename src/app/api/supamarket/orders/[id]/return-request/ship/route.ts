// POST — buyer marks return item as shipped to seller
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";
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

    const body = await req.json();
    const trackingNumber = String(body?.tracking_number ?? "").trim().slice(0, 120);
    const trackingCarrier = String(body?.tracking_carrier ?? "").trim().slice(0, 120);
    const note = String(body?.note ?? "").trim().slice(0, 1000);
    if (!trackingNumber) {
      return withCors(NextResponse.json({ success: false, error: "Return tracking number is required" }, { status: 400 }), req);
    }

    const supabase = await createAdminClient();
    const { data: order } = await supabase.from("orders").select("id, buyer_id, status").eq("id", orderId).single();
    if (!order) return withCors(NextResponse.json({ success: false, error: "Order not found" }, { status: 404 }), req);
    if (order.buyer_id !== payload.userId) {
      return withCors(NextResponse.json({ success: false, error: "Only buyer can submit return shipment" }, { status: 403 }), req);
    }
    if (order.status !== "delivered") {
      return withCors(NextResponse.json({ success: false, error: "Order is not eligible for return shipment" }, { status: 400 }), req);
    }

    const { data: rr } = await supabase
      .from("market_return_requests")
      .select("id, status")
      .eq("order_id", orderId)
      .eq("status", "seller_approved_return")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!rr) {
      return withCors(NextResponse.json({ success: false, error: "No approved return request to ship" }, { status: 400 }), req);
    }

    const now = new Date().toISOString();
    const { error: upErr } = await supabase
      .from("market_return_requests")
      .update({
        status: "buyer_return_shipped",
        buyer_return_tracking_number: trackingNumber,
        buyer_return_tracking_carrier: trackingCarrier || null,
        buyer_return_note: note || null,
        buyer_return_shipped_at: now,
        updated_at: now,
      })
      .eq("id", rr.id);
    if (upErr) return withCors(NextResponse.json({ success: false, error: upErr.message }, { status: 500 }), req);

    const { data: updated } = await supabase.from("market_return_requests").select("*").eq("id", rr.id).single();
    return withCors(NextResponse.json({ success: true, data: { return_request: updated } }), req);
  } catch {
    return withCors(NextResponse.json({ success: false }, { status: 500 }), req);
  }
}
