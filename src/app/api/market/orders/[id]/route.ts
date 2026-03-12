// src/app/api/market/orders/[id]/route.ts
// PATCH — update order status
//
// ESCROW RELEASE:
// When buyer marks order as "completed" (delivered → completed):
//   1. seller_earnings status: escrow → pending (released, can withdraw after hold)
//   2. admin_revenue record created (commission recorded)
//   3. listing stock decremented

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

type Params = { params: Promise<{ id: string }> };

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending:    ["paid", "cancelled"],
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
  shipped:    "seller",
  meetup_set: "seller",
  delivered:  "buyer",   // buyer confirms received
  completed:  "buyer",   // buyer confirms satisfied → releases escrow
  disputed:   "buyer",
  cancelled:  "both",
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

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

    if (error || !data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const body = await req.json();
    const { status: newStatus, tracking_number, meetup_location, meetup_time, pi_payment_id } = body;

    const supabase = await createAdminClient();
    const { data: order } = await supabase.from("orders").select("*").eq("id", id).single();
    if (!order) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const isBuyer  = order.buyer_id  === payload.userId;
    const isSeller = order.seller_id === payload.userId;
    if (!isBuyer && !isSeller)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });

    // Validate transition
    if (newStatus) {
      const allowed = VALID_TRANSITIONS[order.status] ?? [];
      if (!allowed.includes(newStatus))
        return NextResponse.json({ success: false, error: `Cannot move from ${order.status} to ${newStatus}` }, { status: 400 });

      // Validate actor
      const actor = TRANSITION_ACTOR[newStatus];
      if (actor === "buyer"  && !isBuyer)
        return NextResponse.json({ success: false, error: "Only buyer can perform this action" }, { status: 403 });
      if (actor === "seller" && !isSeller)
        return NextResponse.json({ success: false, error: "Only seller can perform this action" }, { status: 403 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (newStatus)       updates.status = newStatus;
    if (tracking_number) updates.tracking_number = tracking_number;
    if (meetup_location) updates.meetup_location = meetup_location;
    if (meetup_time)     updates.meetup_time = meetup_time;
    if (pi_payment_id)   updates.pi_payment_id = pi_payment_id;

    // ── ESCROW RELEASE — buyer confirms completed ──────────────
    if (newStatus === "completed") {
      // 1. Release escrow → seller can now withdraw
      const { data: earning } = await supabase
        .from("seller_earnings")
        .select("id, commission_pi, gross_pi, commission_pct, platform")
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

        console.log(`[Escrow Released] orderId=${id} commission=${earning.commission_pi}π seller earnings unlocked`);
      }

      // 3. Decrement listing stock
      await supabase.from("listings")
        .update({ stock: Math.max(0, (order.stock ?? 1) - 1), updated_at: new Date().toISOString() })
        .eq("id", order.listing_id);
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

    const { data, error } = await supabase
      .from("orders").update(updates).eq("id", id).select().single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
