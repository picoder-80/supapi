// POST — seller accepts (refund buyer / cancel escrow) or rejects return request

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
    const accept = body?.accept === true;
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : "";

    const supabase = await createAdminClient();
    const { data: order } = await supabase.from("orders").select("id, seller_id, status").eq("id", orderId).single();
    if (!order) return withCors(NextResponse.json({ success: false, error: "Order not found" }, { status: 404 }), req);
    if (order.seller_id !== payload.userId) {
      return withCors(NextResponse.json({ success: false, error: "Only the seller can respond" }, { status: 403 }), req);
    }
    if (order.status !== "delivered") {
      return withCors(NextResponse.json({ success: false, error: "Order is not in a state that allows return responses" }, { status: 400 }), req);
    }

    const { data: rr } = await supabase
      .from("market_return_requests")
      .select("*")
      .eq("order_id", orderId)
      .eq("status", "pending_seller")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!rr) {
      return withCors(NextResponse.json({ success: false, error: "No pending return request" }, { status: 400 }), req);
    }

    const now = new Date().toISOString();

    if (accept) {
      const buyerReturnHours = Math.min(
        336,
        Math.max(24, parseInt(process.env.MARKET_RETURN_BUYER_SHIP_HOURS ?? "120", 10) || 120)
      );
      const buyerDeadlineIso = new Date(Date.now() + buyerReturnHours * 3600_000).toISOString();
      const { error: rErr } = await supabase
        .from("market_return_requests")
        .update({
          status: "seller_approved_return",
          seller_note: note || null,
          seller_responded_at: now,
          buyer_return_deadline: buyerDeadlineIso,
          updated_at: now,
        })
        .eq("id", rr.id);
      if (rErr) return withCors(NextResponse.json({ success: false, error: rErr.message }, { status: 500 }), req);

      return withCors(
        NextResponse.json({
          success: true,
          data: { return_request_status: "seller_approved_return", buyer_return_deadline: buyerDeadlineIso },
        }),
        req
      );
    }

    if (!note) {
      return withCors(NextResponse.json({ success: false, error: "Please add a short note when declining" }, { status: 400 }), req);
    }

    const { error: rErr } = await supabase
      .from("market_return_requests")
      .update({
        status: "seller_rejected",
        seller_note: note,
        seller_responded_at: now,
        updated_at: now,
      })
      .eq("id", rr.id);
    if (rErr) return withCors(NextResponse.json({ success: false, error: rErr.message }, { status: 500 }), req);

    const { data: updatedRr } = await supabase.from("market_return_requests").select("*").eq("id", rr.id).single();
    return withCors(NextResponse.json({ success: true, data: { return_request: updatedRr } }), req);
  } catch {
    return withCors(NextResponse.json({ success: false }, { status: 500 }), req);
  }
}
