// src/app/api/supamarket/orders/[id]/route.ts
// PATCH — update order status. CORS enabled for Pi Sandbox.
//
// ESCROW RELEASE:
// When buyer marks order as "completed" (delivered → completed):
//   1. seller_earnings status: escrow → pending (released, can withdraw after hold)
//   2. admin_revenue record created (commission recorded)
//   3. listing stock decremented

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";
import { releaseEscrowForMarketOrderCompletion } from "@/lib/market/complete-market-order";
import * as R from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending:    ["paid", "escrow", "cancelled"],
  escrow:     ["shipped", "meetup_set", "cancelled"],
  paid:       ["shipped", "meetup_set", "cancelled"],
  shipped:    ["delivered"],
  meetup_set: ["delivered"],
  delivered:  ["completed", "disputed"],
  completed:  [],
  disputed:   [],
  refunded:   [],
  cancelled:  [],
};

// Who can trigger which transition
const TRANSITION_ACTOR: Record<string, "buyer" | "seller" | "both"> = {
  paid:       "both",
  escrow:     "both",
  shipped:    "seller",
  meetup_set: "seller",
  delivered:  "buyer",   // buyer confirms received
  completed:  "buyer",   // buyer confirms satisfied → releases escrow
  disputed:   "buyer",
  cancelled:  "both",
};

const getEffectiveOrderStatus = (order: {
  status: string;
  pi_payment_id?: string | null;
  tracking_number?: string | null;
  meetup_location?: string | null;
  buying_method?: string | null;
}) => {
  if (order.status !== "pending") return order.status;
  if (!order.pi_payment_id) return order.status;

  const hasTracking = Boolean(order.tracking_number?.trim());
  const hasMeetup = Boolean(order.meetup_location?.trim());
  const method = order.buying_method ?? "";

  if ((method === "ship" || method === "both") && hasTracking) return "shipped";
  if ((method === "meetup" || method === "both") && hasMeetup) return "meetup_set";
  return "paid";
};

const cors = (req: NextRequest) => req.headers.get("origin");
const withCors = (res: NextResponse, req: NextRequest) => R.withCors(res, cors(req));

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: R.corsHeaders("*") });
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return withCors(NextResponse.json({ success: false }, { status: 401 }), req);
    const payload = verifyToken(auth);
    if (!payload) return withCors(NextResponse.json({ success: false }, { status: 401 }), req);

    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        listing:listing_id ( id, title, images, price_pi, category, subcategory, category_deep, description, location ),
        buyer:buyer_id ( id, username, display_name, avatar_url, phone, email ),
        seller:seller_id ( id, username, display_name, avatar_url, phone ),
        disputes ( * )
      `)
      .eq("id", id)
      .or(`buyer_id.eq.${payload.userId},seller_id.eq.${payload.userId}`)
      .single();

    if (error || !data) return withCors(NextResponse.json({ success: false, error: "Not found" }, { status: 404 }), req);
    const normalized = { ...data, status: getEffectiveOrderStatus(data) } as Record<string, unknown>;
    delete normalized.tracking_url;

    // has_review: whether buyer has left a review for this order's listing
    let hasReview = false;
    const listingId = (data as { listing_id?: string }).listing_id;
    if (listingId && (data as { buyer_id?: string }).buyer_id === payload.userId) {
      const { data: rev } = await supabase
        .from("reviews")
        .select("id")
        .eq("target_type", "listing")
        .eq("target_id", listingId)
        .eq("reviewer_id", payload.userId)
        .maybeSingle();
      hasReview = !!rev;
    }
    (normalized as Record<string, unknown>).has_review = hasReview;

    const { data: rrList, error: rrErr } = await supabase
      .from("market_return_requests")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: false })
      .limit(1);
    (normalized as Record<string, unknown>).return_request = !rrErr ? (rrList?.[0] ?? null) : null;

    return withCors(NextResponse.json({ success: true, data: normalized }), req);
  } catch {
    return withCors(NextResponse.json({ success: false }, { status: 500 }), req);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return withCors(NextResponse.json({ success: false }, { status: 401 }), req);
    const payload = verifyToken(auth);
    if (!payload) return withCors(NextResponse.json({ success: false }, { status: 401 }), req);

    const body = await req.json();
    const { status: newStatus, tracking_number, tracking_carrier, meetup_location, meetup_time, pi_payment_id } = body;

    const supabase = await createAdminClient();
    const { data: order } = await supabase.from("orders").select("*").eq("id", id).single();
    if (!order) return withCors(NextResponse.json({ success: false, error: "Not found" }, { status: 404 }), req);

    const isBuyer  = order.buyer_id  === payload.userId;
    const isSeller = order.seller_id === payload.userId;
    if (!isBuyer && !isSeller)
      return withCors(NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 }), req);

    // Validate transition
    if (newStatus) {
      const effectiveStatus = getEffectiveOrderStatus(order);
      const allowed = VALID_TRANSITIONS[effectiveStatus] ?? [];
      if (!allowed.includes(newStatus))
        return withCors(NextResponse.json({ success: false, error: `Cannot move from ${effectiveStatus} to ${newStatus}` }, { status: 400 }), req);

      if (newStatus === "completed" && isBuyer) {
        const { data: pendRr, error: pendErr } = await supabase
          .from("market_return_requests")
          .select("id")
          .eq("order_id", id)
          .eq("status", "pending_seller")
          .maybeSingle();
        if (!pendErr && pendRr) {
          return withCors(
            NextResponse.json(
              {
                success: false,
                error:
                  "Withdraw or wait for the seller to respond to your return request before completing the order.",
              },
              { status: 400 }
            ),
            req
          );
        }
      }

      // Validate actor
      const actor = TRANSITION_ACTOR[newStatus];
      if (actor === "buyer"  && !isBuyer)
        return withCors(NextResponse.json({ success: false, error: "Only buyer can perform this action" }, { status: 403 }), req);
      if (actor === "seller" && !isSeller)
        return withCors(NextResponse.json({ success: false, error: "Only seller can perform this action" }, { status: 403 }), req);
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (newStatus)         updates.status = newStatus;
    if (newStatus === "shipped" || newStatus === "meetup_set") {
      const fulfilledAt = (order as { fulfilled_at?: string | null }).fulfilled_at;
      if (!fulfilledAt) updates.fulfilled_at = new Date().toISOString();
    }
    if (newStatus === "delivered") {
      updates.delivered_at = new Date().toISOString();
    }
    if (tracking_number) {
      updates.tracking_number = tracking_number;
      updates.tracking_url = null;
    }
    if (tracking_carrier) updates.tracking_carrier = tracking_carrier;
    if (meetup_location)   updates.meetup_location = meetup_location;
    if (meetup_time)     updates.meetup_time = meetup_time;
    if (pi_payment_id)   updates.pi_payment_id = pi_payment_id;

    // ── ESCROW RELEASE — buyer confirms completed ──────────────
    if (newStatus === "completed") {
      const rel = await releaseEscrowForMarketOrderCompletion({
        supabase,
        orderId: id,
        origin: req.nextUrl.origin,
        order: {
          listing_id: (order as { listing_id?: string | null }).listing_id,
          seller_id:  order.seller_id,
        },
      });
      if (!rel.ok) {
        return withCors(NextResponse.json({ success: false, error: rel.error }, { status: 500 }), req);
      }
    }

    // ── CANCELLATION — refund escrow (admin manual refund) ────
    if (newStatus === "cancelled") {
      // Mark escrow as cancelled — admin will refund from Pi App manually
      await supabase.from("seller_earnings")
        .update({ status: "cancelled" })
        .eq("order_id", id)
        .eq("status", "escrow");

      console.log(`[Escrow Cancelled] orderId=${id} — admin to process refund manually`);
    }

    let { data, error } = await supabase
      .from("orders").update(updates).eq("id", id).select().single();

    // Compatibility fallback for legacy status constraints that reject shipped/meetup_set.
    if (error && (error as { code?: string }).code === "23514" && (newStatus === "shipped" || newStatus === "meetup_set")) {
      const fallbackUpdates = { ...updates };
      delete fallbackUpdates.status;
      const retry = await supabase
        .from("orders")
        .update(fallbackUpdates)
        .eq("id", id)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
      if (!error) {
        console.warn(`[Orders PATCH] Legacy status constraint fallback used for ${newStatus} on order ${id}`);
      }
    }

    if (error) return withCors(NextResponse.json({ success: false, error: error.message }, { status: 500 }), req);
    const normalized = { ...data, status: getEffectiveOrderStatus(data) } as Record<string, unknown>;
    delete normalized.tracking_url;
    return withCors(NextResponse.json({ success: true, data: normalized }), req);
  } catch {
    return withCors(NextResponse.json({ success: false }, { status: 500 }), req);
  }
}
