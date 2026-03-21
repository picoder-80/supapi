// GET — latest return request for order (buyer or seller)
// POST — buyer creates return/refund request (order must be delivered)
// DELETE — buyer withdraws pending request

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";
import { checkRateLimit } from "@/lib/security/rate-limit";
import * as R from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

function sellerResponseDeadlineIso(): string {
  const h = Math.min(168, Math.max(24, parseInt(process.env.MARKET_RETURN_SELLER_RESPONSE_HOURS ?? "72", 10) || 72));
  return new Date(Date.now() + h * 3600_000).toISOString();
}

const cors = (req: NextRequest) => req.headers.get("origin");
const withCors = (res: NextResponse, req: NextRequest) => R.withCors(res, cors(req));

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: R.corsHeaders("*") });
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: orderId } = await params;
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return withCors(NextResponse.json({ success: false }, { status: 401 }), req);
    const payload = verifyToken(auth);
    if (!payload) return withCors(NextResponse.json({ success: false }, { status: 401 }), req);

    const supabase = await createAdminClient();
    const { data: order } = await supabase
      .from("orders")
      .select("id, buyer_id, seller_id")
      .eq("id", orderId)
      .single();
    if (!order) return withCors(NextResponse.json({ success: false, error: "Not found" }, { status: 404 }), req);
    if (order.buyer_id !== payload.userId && order.seller_id !== payload.userId) {
      return withCors(NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 }), req);
    }

    const { data: row } = await supabase
      .from("market_return_requests")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return withCors(NextResponse.json({ success: true, data: { return_request: row ?? null } }), req);
  } catch {
    return withCors(NextResponse.json({ success: false }, { status: 500 }), req);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const rl = checkRateLimit(req, "market_return_create", 6, 3600_000);
    if (!rl.ok) {
      return withCors(
        NextResponse.json(
          { success: false, error: "Too many return requests. Try again later." },
          { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
        ),
        req
      );
    }

    const { id: orderId } = await params;
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return withCors(NextResponse.json({ success: false }, { status: 401 }), req);
    const payload = verifyToken(auth);
    if (!payload) return withCors(NextResponse.json({ success: false }, { status: 401 }), req);

    const body = await req.json();
    const category = typeof body?.category === "string" ? body.category.trim().slice(0, 80) : "";
    const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 4000) : "";
    const evidence = Array.isArray(body?.evidence) ? body.evidence : [];

    if (!category || !reason) {
      return withCors(NextResponse.json({ success: false, error: "Category and reason are required" }, { status: 400 }), req);
    }

    const supabase = await createAdminClient();
    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("id, buyer_id, seller_id, status")
      .eq("id", orderId)
      .single();
    if (oErr || !order) return withCors(NextResponse.json({ success: false, error: "Order not found" }, { status: 404 }), req);
    if (order.buyer_id !== payload.userId) {
      return withCors(NextResponse.json({ success: false, error: "Only the buyer can open a return request" }, { status: 403 }), req);
    }
    if (order.status !== "delivered") {
      return withCors(
        NextResponse.json({ success: false, error: "Return requests are only available after you confirm receipt" }, { status: 400 }),
        req
      );
    }

    const { data: openDispute } = await supabase
      .from("disputes")
      .select("id")
      .eq("order_id", orderId)
      .neq("status", "resolved")
      .maybeSingle();
    if (openDispute) {
      return withCors(NextResponse.json({ success: false, error: "This order already has an open case" }, { status: 400 }), req);
    }

    const { data: activeRequest } = await supabase
      .from("market_return_requests")
      .select("id, status")
      .eq("order_id", orderId)
      .in("status", ["pending_seller", "seller_approved_return", "buyer_return_shipped"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeRequest) {
      return withCors(
        NextResponse.json(
          { success: false, error: "An active return request already exists for this order" },
          { status: 400 }
        ),
        req
      );
    }

    const { data: inserted, error: insErr } = await supabase
      .from("market_return_requests")
      .insert({
        order_id: orderId,
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        category,
        reason,
        evidence,
        status: "pending_seller",
        seller_response_deadline: sellerResponseDeadlineIso(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insErr) {
      if (insErr.code === "23505") {
        return withCors(
          NextResponse.json({ success: false, error: "You already have a pending return request for this order" }, { status: 400 }),
          req
        );
      }
      return withCors(NextResponse.json({ success: false, error: insErr.message }, { status: 500 }), req);
    }

    return withCors(NextResponse.json({ success: true, data: { return_request: inserted } }), req);
  } catch {
    return withCors(NextResponse.json({ success: false }, { status: 500 }), req);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id: orderId } = await params;
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return withCors(NextResponse.json({ success: false }, { status: 401 }), req);
    const payload = verifyToken(auth);
    if (!payload) return withCors(NextResponse.json({ success: false }, { status: 401 }), req);

    const supabase = await createAdminClient();
    const { data: order } = await supabase.from("orders").select("buyer_id").eq("id", orderId).single();
    if (!order) return withCors(NextResponse.json({ success: false, error: "Not found" }, { status: 404 }), req);
    if (order.buyer_id !== payload.userId) {
      return withCors(NextResponse.json({ success: false, error: "Only the buyer can withdraw" }, { status: 403 }), req);
    }

    const { data: pending } = await supabase
      .from("market_return_requests")
      .select("id")
      .eq("order_id", orderId)
      .eq("status", "pending_seller")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!pending) {
      return withCors(NextResponse.json({ success: false, error: "No pending return request to withdraw" }, { status: 400 }), req);
    }

    const { error: upErr } = await supabase
      .from("market_return_requests")
      .update({ status: "buyer_cancelled", updated_at: new Date().toISOString() })
      .eq("id", pending.id);

    if (upErr) return withCors(NextResponse.json({ success: false, error: upErr.message }, { status: 500 }), req);
    return withCors(NextResponse.json({ success: true }), req);
  } catch {
    return withCors(NextResponse.json({ success: false }, { status: 500 }), req);
  }
}
