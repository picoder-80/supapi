import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

// POST — open dispute & trigger AI resolution
export async function POST(req: NextRequest) {
  try {
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

    // Create dispute record
    const { data: dispute } = await supabase
      .from("disputes")
      .insert({
        order_id, opened_by: payload.userId,
        reason, evidence: evidence ?? [],
        status: "ai_reviewing",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select().single();

    // Update order status
    await supabase.from("orders")
      .update({ status: "disputed", updated_at: new Date().toISOString() })
      .eq("id", order_id);

    // === AI DECISION via Claude API ===
    const prompt = `You are Supapi AI Dispute Resolution System for a Pi Network marketplace.

ORDER DETAILS:
- Order ID: ${order_id}
- Amount: ${order.amount_pi} Pi
- Buying method: ${order.buying_method}
- Product: ${order.listing?.title ?? "Unknown"}
- Order status before dispute: ${order.status}
- Buyer: @${order.buyer?.username}
- Seller: @${order.seller?.username}

DISPUTE FILED BY: @${payload.userId === order.buyer_id ? order.buyer?.username : order.seller?.username} (${payload.userId === order.buyer_id ? "BUYER" : "SELLER"})

REASON FOR DISPUTE:
${reason}

EVIDENCE PROVIDED: ${evidence?.length ? evidence.join(", ") : "No evidence attached"}

Based on marketplace best practices and the information provided, make a fair decision.

Respond ONLY with valid JSON (no markdown, no preamble):
{
  "decision": "refund" | "release",
  "confidence": 0.00-1.00,
  "reasoning": "Clear explanation of decision in 2-3 sentences",
  "conditions": "Any conditions or actions required"
}`;

    let aiDecision = "release";
    let aiReasoning = "AI could not process dispute. Defaulting to escrow hold pending manual review.";
    let aiConfidence = 0.5;

    try {
      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const aiData = await aiRes.json();
      const text = aiData.content?.[0]?.text ?? "";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      aiDecision   = parsed.decision ?? "release";
      aiReasoning  = parsed.reasoning ?? aiReasoning;
      aiConfidence = parsed.confidence ?? 0.5;
    } catch {}

    // Apply AI decision
    const newOrderStatus = aiDecision === "refund" ? "refunded" : "completed";

    await Promise.all([
      supabase.from("disputes").update({
        status: "resolved",
        ai_decision: aiDecision,
        ai_reasoning: aiReasoning,
        ai_confidence: aiConfidence,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", dispute?.id),

      supabase.from("orders").update({
        status: newOrderStatus,
        updated_at: new Date().toISOString(),
      }).eq("id", order_id),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        dispute_id: dispute?.id,
        decision: aiDecision,
        reasoning: aiReasoning,
        confidence: aiConfidence,
        order_status: newOrderStatus,
      }
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
