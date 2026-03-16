import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";
import { analyzeDispute, shouldAutoResolveDispute } from "@/lib/market/ai";
import { checkRateLimit } from "@/lib/security/rate-limit";

// POST — open dispute and run AI auto-check
export async function POST(req: NextRequest) {
  try {
    const rl = checkRateLimit(req, "market_dispute_create", 8, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please retry shortly." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const body = await req.json();
    const { order_id, reason, evidence } = body;

    if (!order_id || !reason)
      return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });

    const supabase = await createAdminClient();

    // Get order with full context
    const { data: order } = await supabase
      .from("orders")
      .select(`*, listing:listing_id(*), buyer:buyer_id(username), seller:seller_id(username)`)
      .eq("id", order_id)
      .single();

    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    if (order.buyer_id !== payload.userId && order.seller_id !== payload.userId)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    if (order.status !== "delivered" && order.status !== "disputed")
      return NextResponse.json({ success: false, error: "Order not eligible for dispute" }, { status: 400 });

    const { data: existing } = await supabase
      .from("disputes")
      .select("id")
      .eq("order_id", order_id)
      .neq("status", "resolved")
      .maybeSingle();
    if (existing)
      return NextResponse.json({ success: false, error: "A dispute is already open for this order" }, { status: 400 });

    // Create dispute record
    const { data: dispute } = await supabase
      .from("disputes")
      .insert({
        order_id, opened_by: payload.userId,
        reason, evidence: evidence ?? [],
        status: "open",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select().single();

    // Update order status
    await supabase.from("orders")
      .update({ status: "disputed", updated_at: new Date().toISOString() })
      .eq("id", order_id);

    const analysis = await analyzeDispute({
      reason,
      evidence: evidence ?? [],
      buying_method: order.buying_method,
      order_status: order.status,
      amount_pi: Number(order.amount_pi ?? 0),
    });

    const autoPolicy = shouldAutoResolveDispute(analysis.confidence, Number(order.amount_pi ?? 0));
    const autoResolve = autoPolicy.ok;
    const newOrderStatus = analysis.decision === "refund" ? "refunded" : "completed";

    await supabase
      .from("disputes")
      .update({
        status: autoResolve ? "resolved" : "open",
        ai_decision: analysis.decision,
        ai_reasoning: analysis.reasoning,
        ai_confidence: analysis.confidence,
        resolved_at: autoResolve ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dispute?.id);

    if (autoResolve) {
      await supabase.from("orders").update({
        status: newOrderStatus,
        updated_at: new Date().toISOString(),
      }).eq("id", order_id);

      // Escrow handling when auto-resolved
      if (newOrderStatus === "completed") {
        const { data: earning } = await supabase
          .from("seller_earnings")
          .select("id, commission_pi, gross_pi, net_pi, commission_pct, platform")
          .eq("order_id", order_id)
          .eq("status", "escrow")
          .single();

        if (earning) {
          await supabase.from("seller_earnings")
            .update({ status: "pending" })
            .eq("id", earning.id);

          await supabase.from("admin_revenue").insert({
            platform:       earning.platform,
            order_id:       order_id,
            gross_pi:       earning.gross_pi,
            commission_pi:  earning.commission_pi,
            commission_pct: earning.commission_pct,
          });

          if (order.listing_id) {
            const { data: listing } = await supabase
              .from("listings")
              .select("id, stock")
              .eq("id", order.listing_id)
              .single();
            if (listing) {
              await supabase.from("listings")
                .update({ stock: Math.max(0, (listing.stock ?? 1) - 1), updated_at: new Date().toISOString() })
                .eq("id", listing.id);
            }
          }
        }
      } else if (newOrderStatus === "refunded") {
        await supabase.from("seller_earnings")
          .update({ status: "cancelled" })
          .eq("order_id", order_id)
          .eq("status", "escrow");
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        dispute_id: dispute?.id,
        decision: analysis.decision,
        reasoning: analysis.reasoning,
        confidence: analysis.confidence,
        auto_resolved: autoResolve,
        auto_resolve_reason: autoPolicy.reason,
        order_status: autoResolve ? newOrderStatus : "disputed",
      }
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
