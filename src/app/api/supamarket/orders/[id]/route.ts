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

async function creditSellerEarnings(params: {
  origin: string;
  sellerId: string;
  orderId: string;
  amountPi: number;
}) {
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (!internalSecret) {
    console.warn("[Earnings Credit] INTERNAL_API_SECRET missing");
    return;
  }

  const response = await fetch(`${params.origin}/api/wallet`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": internalSecret,
    },
    body: JSON.stringify({
      action: "credit_earnings",
      target_user_id: params.sellerId,
      type: "market_order",
      source: "Marketplace Order Completion",
      amount_pi: params.amountPi,
      status: "available",
      ref_id: params.orderId,
      note: `Auto payout for completed order ${params.orderId}`,
    }),
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    console.warn(`[Earnings Credit] Failed for order ${params.orderId}: ${response.status} ${payload}`);
  }
}

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
        listing:listing_id ( id, title, images, price_pi, category, description, location ),
        buyer:buyer_id ( id, username, display_name, avatar_url, phone, email ),
        seller:seller_id ( id, username, display_name, avatar_url, phone ),
        disputes ( * )
      `)
      .eq("id", id)
      .or(`buyer_id.eq.${payload.userId},seller_id.eq.${payload.userId}`)
      .single();

    if (error || !data) return withCors(NextResponse.json({ success: false, error: "Not found" }, { status: 404 }), req);
    const normalized = { ...data, status: getEffectiveOrderStatus(data) };
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
    const { status: newStatus, tracking_number, tracking_carrier, tracking_url, meetup_location, meetup_time, pi_payment_id } = body;

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

      // Validate actor
      const actor = TRANSITION_ACTOR[newStatus];
      if (actor === "buyer"  && !isBuyer)
        return withCors(NextResponse.json({ success: false, error: "Only buyer can perform this action" }, { status: 403 }), req);
      if (actor === "seller" && !isSeller)
        return withCors(NextResponse.json({ success: false, error: "Only seller can perform this action" }, { status: 403 }), req);
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (newStatus)         updates.status = newStatus;
    if (tracking_number)   updates.tracking_number = tracking_number;
    if (tracking_carrier)  updates.tracking_carrier = tracking_carrier;
    if (tracking_url)      updates.tracking_url = tracking_url;
    if (meetup_location)   updates.meetup_location = meetup_location;
    if (meetup_time)     updates.meetup_time = meetup_time;
    if (pi_payment_id)   updates.pi_payment_id = pi_payment_id;

    // ── ESCROW RELEASE — buyer confirms completed ──────────────
    if (newStatus === "completed") {
      // 1. Release escrow → seller can now withdraw
      const { data: earning } = await supabase
        .from("seller_earnings")
        .select("id, commission_pi, gross_pi, net_pi, commission_pct, platform")
        .eq("order_id", id)
        .eq("status", "escrow")
        .single();

      if (earning) {
        await supabase.from("seller_earnings")
          .update({ status: "pending" }) // pending = released, awaiting withdrawal
          .eq("id", earning.id);

        // 2. Record admin commission revenue
        await supabase.from("admin_revenue").insert({
          platform:       earning.platform,
          order_id:       id,
          gross_pi:       earning.gross_pi,
          commission_pi:  earning.commission_pi,
          commission_pct: earning.commission_pct,
        });

        const sellerAmount = Number(earning.net_pi ?? 0);
        if (sellerAmount > 0 && order.seller_id) {
          // Best-effort: do not block order completion if wallet credit has transient failure.
          await creditSellerEarnings({
            origin: req.nextUrl.origin,
            sellerId: String(order.seller_id),
            orderId: id,
            amountPi: sellerAmount,
          });
        }

        console.log(`[Escrow Released] orderId=${id} commission=${earning.commission_pi}π seller earnings unlocked`);
      }

      // 3. Decrement listing stock
      if (order.listing_id) {
        const { data: listing } = await supabase
          .from("listings")
          .select("id, stock")
          .eq("id", order.listing_id)
          .single();

        if (listing) {
          await supabase
            .from("listings")
            .update({ stock: Math.max(0, (listing.stock ?? 1) - 1), updated_at: new Date().toISOString() })
            .eq("id", listing.id);
        }
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
    const normalized = { ...data, status: getEffectiveOrderStatus(data) };
    return withCors(NextResponse.json({ success: true, data: normalized }), req);
  } catch {
    return withCors(NextResponse.json({ success: false }, { status: 500 }), req);
  }
}
