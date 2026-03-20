import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { creditSellerEarningsMarket } from "@/lib/market/complete-market-order";

type Params = { params: Promise<{ id: string }> };

// Admin can force any status
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.market.write")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const allowedStatuses = new Set([
    "pending",
    "paid",
    "shipped",
    "delivered",
    "completed",
    "disputed",
    "refunded",
    "cancelled",
  ]);

  if ("status" in body) {
    const nextStatus = String(body.status ?? "");
    if (!allowedStatuses.has(nextStatus)) {
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
    }
    updates.status = nextStatus;
  }

  if ("note" in body) updates.note = body.note ?? null;
  if ("tracking_number" in body) updates.tracking_number = body.tracking_number ?? null;
  if ("shipping_proof_url" in body) updates.shipping_proof_url = body.shipping_proof_url ?? null;
  if ("delivered_at" in body) updates.delivered_at = body.delivered_at ?? null;
  if ("completed_at" in body) updates.completed_at = body.completed_at ?? null;
  if ("cancel_reason" in body) updates.cancel_reason = body.cancel_reason ?? null;
  if ("refund_reason" in body) updates.refund_reason = body.refund_reason ?? null;

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ success: false, error: "No allowed fields to update" }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const { data: currentOrder } = await supabase
    .from("orders")
    .select("id, status, listing_id, seller_id")
    .eq("id", id)
    .maybeSingle();
  if (!currentOrder?.id) {
    return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", id).select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const nextStatus = typeof body.status === "string" ? String(body.status) : null;
  if (nextStatus === "completed" && currentOrder.status !== "completed") {
    const origin = new URL(req.url).origin;
    const { data: earning } = await supabase
      .from("seller_earnings")
      .select("id, status, commission_pi, gross_pi, net_pi, commission_pct, platform")
      .eq("order_id", id)
      .maybeSingle();

    if (earning?.id) {
      if (earning.status === "escrow") {
        await supabase
          .from("seller_earnings")
          .update({ status: "pending" })
          .eq("id", earning.id);
      }

      const { data: existingRevenue } = await supabase
        .from("admin_revenue")
        .select("id")
        .eq("order_id", id)
        .maybeSingle();
      if (!existingRevenue?.id) {
        await supabase.from("admin_revenue").insert({
          platform: String(earning.platform ?? "market"),
          order_id: id,
          gross_pi: earning.gross_pi,
          commission_pi: earning.commission_pi,
          commission_pct: earning.commission_pct,
        });
      }

      const sellerAmount = Number(earning.net_pi ?? 0);
      if (sellerAmount > 0 && currentOrder.seller_id) {
        await creditSellerEarningsMarket({
          origin,
          sellerId: String(currentOrder.seller_id),
          orderId: id,
          amountPi: sellerAmount,
        });
      }
    }

    if (currentOrder.listing_id) {
      const { data: listing } = await supabase
        .from("listings")
        .select("id, stock")
        .eq("id", currentOrder.listing_id)
        .maybeSingle();
      if (listing?.id) {
        await supabase
          .from("listings")
          .update({ stock: Math.max(0, (listing.stock ?? 1) - 1), updated_at: new Date().toISOString() })
          .eq("id", listing.id);
      }
    }
  }

  if ((nextStatus === "cancelled" || nextStatus === "refunded") && currentOrder.status !== nextStatus) {
    await supabase
      .from("seller_earnings")
      .update({ status: "cancelled" })
      .eq("order_id", id)
      .eq("status", "escrow");
  }

  return NextResponse.json({ success: true, data });
}