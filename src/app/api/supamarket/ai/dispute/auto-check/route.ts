import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";
import { analyzeDispute, shouldAutoResolveDispute } from "@/lib/market/ai";

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const disputeId = String(body?.dispute_id ?? "").trim();
    if (!disputeId) {
      return NextResponse.json({ success: false, error: "dispute_id is required" }, { status: 400 });
    }

    const supabase = await createAdminClient();
    const { data: dispute } = await supabase
      .from("disputes")
      .select("id, order_id, opened_by, reason, evidence, status")
      .eq("id", disputeId)
      .single();

    if (!dispute) return NextResponse.json({ success: false, error: "Dispute not found" }, { status: 404 });

    const { data: order } = await supabase
      .from("orders")
      .select("id, buyer_id, seller_id, status, buying_method, amount_pi")
      .eq("id", dispute.order_id)
      .single();

    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    if (order.buyer_id !== payload.userId && order.seller_id !== payload.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized for this dispute" }, { status: 403 });
    }

    const analysis = await analyzeDispute({
      reason: dispute.reason,
      evidence: Array.isArray(dispute.evidence) ? dispute.evidence.map(String) : [],
      buying_method: order.buying_method,
      order_status: order.status,
      amount_pi: Number(order.amount_pi ?? 0),
    });

    const autoPolicy = shouldAutoResolveDispute(analysis.confidence, Number(order.amount_pi ?? 0));
    const autoResolve = autoPolicy.ok;
    const nextOrderStatus = analysis.decision === "refund" ? "refunded" : "completed";

    await supabase
      .from("disputes")
      .update({
        ai_decision: analysis.decision,
        ai_reasoning: analysis.reasoning,
        ai_confidence: analysis.confidence,
        status: autoResolve ? "resolved" : "open",
        resolved_at: autoResolve ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dispute.id);

    if (autoResolve) {
      await supabase
        .from("orders")
        .update({ status: nextOrderStatus, updated_at: new Date().toISOString() })
        .eq("id", order.id);
    }

    return NextResponse.json({
      success: true,
      data: {
        dispute_id: dispute.id,
        auto_resolved: autoResolve,
        auto_resolve_reason: autoPolicy.reason,
        order_status: autoResolve ? nextOrderStatus : order.status,
        ...analysis,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
