// POST /api/supamarket/orders/[id]/review
// Buyer leaves rating for seller (via listing) after order completed

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: orderId } = await params;
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const rating = Number(body?.rating);
    const comment = typeof body?.comment === "string" ? body.comment.trim().slice(0, 500) : null;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: "Rating must be 1–5" }, { status: 400 });
    }

    const supabase = await createAdminClient();
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, buyer_id, seller_id, listing_id, status")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    if (order.buyer_id !== payload.userId) {
      return NextResponse.json({ success: false, error: "Only the buyer can leave a review" }, { status: 403 });
    }

    if (order.status !== "completed") {
      return NextResponse.json({ success: false, error: "Can only review completed orders" }, { status: 400 });
    }

    const listingId = order.listing_id;
    if (!listingId) {
      return NextResponse.json({ success: false, error: "Order has no listing" }, { status: 400 });
    }

    // One review per buyer per listing (UNIQUE constraint)
    const { error: insertErr } = await supabase.from("reviews").upsert(
      {
        reviewer_id: payload.userId,
        target_id: listingId,
        target_type: "listing",
        rating: Math.round(rating),
        comment: comment || null,
      },
      { onConflict: "reviewer_id,target_id,target_type" }
    );

    if (insertErr) {
      if (insertErr.code === "23505") {
        return NextResponse.json({ success: false, error: "You have already reviewed this purchase" }, { status: 400 });
      }
      return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
