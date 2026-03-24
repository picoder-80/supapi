import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";
import { analyzeDispute, shouldAutoResolveDispute } from "@/lib/market/ai";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { logDisputeEvent } from "@/lib/security/dispute-audit";
import { issueBuyerRefundFromTreasury } from "@/lib/pi/refund";

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
    const { order_id, reason, evidence, return_request_id: returnRequestIdRaw } = body;

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
    if (order.buyer_id !== payload.userId) {
      return NextResponse.json(
        { success: false, error: "Only buyer can open a case for this order." },
        { status: 403 }
      );
    }
    if (order.status !== "delivered" && order.status !== "disputed")
      return NextResponse.json({ success: false, error: "Order not eligible for dispute" }, { status: 400 });

    /** Buyers must complete seller return flow before platform escalation (reduces refund abuse). */
    let sourceReturnRequestId: string | null = null;
    if (order.status === "delivered" && order.buyer_id === payload.userId) {
      const rrId = typeof returnRequestIdRaw === "string" ? returnRequestIdRaw.trim() : "";
      if (!rrId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Request a return from the seller first. If they decline, you can ask for platform review.",
          },
          { status: 400 }
        );
      }
      const { data: rr } = await supabase
        .from("market_return_requests")
        .select("id, status, order_id, buyer_id")
        .eq("id", rrId)
        .single();
      if (!rr || rr.order_id !== order_id || rr.buyer_id !== payload.userId) {
        return NextResponse.json({ success: false, error: "Invalid return request" }, { status: 400 });
      }
      if (!["seller_rejected", "buyer_return_shipped"].includes(String(rr.status))) {
        return NextResponse.json(
          {
            success: false,
            error: "Ask seller first. You can escalate after decline or after return shipment if stuck.",
          },
          { status: 400 }
        );
      }
      sourceReturnRequestId = rrId;
    }

    const { data: existing } = await supabase
      .from("disputes")
      .select("id")
      .eq("order_id", order_id)
      .neq("status", "resolved")
      .maybeSingle();
    if (existing)
      return NextResponse.json({ success: false, error: "A dispute is already open for this order" }, { status: 400 });

    // Create dispute record
    const { data: dispute, error: disputeInsertErr } = await supabase
      .from("disputes")
      .insert({
        order_id,
        opened_by: payload.userId,
        reason,
        evidence: evidence ?? [],
        status: "open",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(sourceReturnRequestId ? { source_return_request_id: sourceReturnRequestId } : {}),
      })
      .select()
      .single();
    if (disputeInsertErr || !dispute?.id) {
      return NextResponse.json({ success: false, error: disputeInsertErr?.message ?? "Failed to create dispute" }, { status: 500 });
    }
    await logDisputeEvent({
      platform: "market",
      disputeId: dispute.id,
      orderId: order_id,
      actorType: "user",
      actorId: payload.userId,
      eventType: "opened",
      fromStatus: order.status,
      toStatus: "disputed",
      reasonExcerpt: reason,
      metadata: { evidence_count: Array.isArray(evidence) ? evidence.length : 0 },
    });

    // Update order status
    const { error: orderDisputedErr } = await supabase.from("orders")
      .update({ status: "disputed", updated_at: new Date().toISOString() })
      .eq("id", order_id);
    if (orderDisputedErr) {
      return NextResponse.json({ success: false, error: orderDisputedErr.message }, { status: 500 });
    }

    if (sourceReturnRequestId) {
      await supabase
        .from("market_return_requests")
        .update({
          status: "escalated",
          escalated_dispute_id: dispute.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sourceReturnRequestId);
    }

    const analysis = await analyzeDispute({
      reason,
      evidence: evidence ?? [],
      buying_method: order.buying_method,
      order_status: order.status,
      amount_pi: Number(order.amount_pi ?? 0),
    });

    const autoPolicy = shouldAutoResolveDispute(analysis.confidence, Number(order.amount_pi ?? 0));
    const newOrderStatus = analysis.decision === "refund" ? "refunded" : "completed";

    let effectiveAutoResolve = autoPolicy.ok;
    if (effectiveAutoResolve && newOrderStatus === "refunded") {
      const amountPi = Number(order.amount_pi ?? 0);
      const { data: buyerRow } = await supabase.from("users").select("pi_uid").eq("id", order.buyer_id).maybeSingle();
      const buyerUid = String(buyerRow?.pi_uid ?? "").trim();
      if (!buyerUid || !Number.isFinite(amountPi) || amountPi <= 0) {
        effectiveAutoResolve = false;
      } else {
        try {
          await issueBuyerRefundFromTreasury({
            buyerUid,
            amountPi,
            memo: `Supapi dispute auto-refund #${String(dispute?.id).slice(0, 8)}`,
            metadata: {
              dispute_id: String(dispute?.id ?? ""),
              order_id: order_id,
              reason: "dispute_auto_refund",
            },
          });
        } catch (e) {
          console.error("[market dispute] Auto refund payout failed; keeping dispute open:", e);
          effectiveAutoResolve = false;
        }
      }
    }

    const { error: disputeAiUpdateErr } = await supabase
      .from("disputes")
      .update({
        status: effectiveAutoResolve ? "resolved" : "open",
        ai_decision: analysis.decision,
        ai_reasoning: analysis.reasoning,
        ai_confidence: analysis.confidence,
        resolved_at: effectiveAutoResolve ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dispute?.id);
    if (disputeAiUpdateErr) {
      return NextResponse.json({ success: false, error: disputeAiUpdateErr.message }, { status: 500 });
    }
    await logDisputeEvent({
      platform: "market",
      disputeId: dispute.id,
      orderId: order_id,
      actorType: "system",
      actorId: null,
      eventType: "analysis_updated",
      fromStatus: "disputed",
      toStatus: effectiveAutoResolve ? "resolved" : "open",
      decision: analysis.decision,
      confidence: analysis.confidence,
      reasonExcerpt: analysis.reasoning,
      metadata: { auto_resolve_reason: autoPolicy.reason },
    });

    if (effectiveAutoResolve) {
      const { error: autoOrderUpdateErr } = await supabase.from("orders").update({
        status: newOrderStatus,
        updated_at: new Date().toISOString(),
      }).eq("id", order_id);
      if (autoOrderUpdateErr) {
        return NextResponse.json({ success: false, error: autoOrderUpdateErr.message }, { status: 500 });
      }
      await logDisputeEvent({
        platform: "market",
        disputeId: dispute.id,
        orderId: order_id,
        actorType: "system",
        actorId: null,
        eventType: "auto_resolved",
        fromStatus: "disputed",
        toStatus: newOrderStatus,
        decision: analysis.decision,
        confidence: analysis.confidence,
        reasonExcerpt: analysis.reasoning,
        metadata: { auto_resolve_reason: autoPolicy.reason },
      });

      if (newOrderStatus === "refunded") {
        await supabase
          .from("transactions")
          .update({ status: "refunded" })
          .eq("reference_id", order_id)
          .eq("status", "completed");
      }

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
        auto_resolved: effectiveAutoResolve,
        auto_resolve_reason: autoPolicy.reason,
        order_status: effectiveAutoResolve ? newOrderStatus : "disputed",
      }
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
