import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { createAdminClient } from "@/lib/supabase/server";
import { issueA2URefund } from "@/lib/pi/refund";
import { logAdminAction } from "@/lib/security/audit";
import { sendPlatformEmail } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok || !auth.userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.market.write")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id: disputeId } = await params;
  const supabase = await createAdminClient();

  const { data: dispute, error: disputeErr } = await supabase
    .from("disputes")
    .select(`
      id, order_id, status, refund_status, refund_txid, refund_amount_pi, ai_reasoning,
      order:order_id(id, status, amount_pi, buyer_id, seller_id, pi_payment_id)
    `)
    .eq("id", disputeId)
    .single();

  const order = Array.isArray(dispute?.order) ? dispute?.order[0] : dispute?.order;

  if (disputeErr || !order) {
    return NextResponse.json({ success: false, error: "Dispute not found" }, { status: 404 });
  }

  if (dispute.refund_status === "completed" && dispute.refund_txid) {
    return NextResponse.json({
      success: true,
      refund: {
        dispute_id: disputeId,
        amount_pi: Number(dispute.refund_amount_pi ?? 0),
        txid: dispute.refund_txid,
        idempotent: true,
      },
    });
  }

  if (dispute.refund_status === "processing") {
    return NextResponse.json({ success: false, error: "Refund is already processing" }, { status: 409 });
  }

  const amountPi = Number(order.amount_pi ?? 0);
  if (!Number.isFinite(amountPi) || amountPi <= 0) {
    return NextResponse.json({ success: false, error: "Invalid order amount for refund" }, { status: 400 });
  }

  const buyerId = String(order.buyer_id ?? "");
  const sellerId = String(order.seller_id ?? "");
  const { data: users } = await supabase
    .from("users")
    .select("id, username, display_name, email, pi_uid")
    .in("id", [buyerId, sellerId]);

  const buyer = (users ?? []).find((u) => u.id === buyerId);
  const seller = (users ?? []).find((u) => u.id === sellerId);
  if (!buyer?.pi_uid) {
    return NextResponse.json({ success: false, error: "Buyer Pi UID not found" }, { status: 400 });
  }

  const { data: txRows } = await supabase
    .from("transactions")
    .select("id, pi_payment_id, txid, status, amount_pi, reference_id, reference_type, metadata")
    .eq("reference_id", order.id)
    .order("created_at", { ascending: false })
    .limit(5);

  await supabase
    .from("disputes")
    .update({ refund_status: "processing", updated_at: new Date().toISOString() })
    .eq("id", disputeId);

  try {
    const refund = await issueA2URefund(buyer.pi_uid, amountPi, disputeId, order.id);
    const now = new Date().toISOString();

    await supabase
      .from("disputes")
      .update({
        status: "resolved",
        ai_decision: "refund",
        ai_reasoning: dispute.ai_reasoning ?? "Resolved in buyer's favour via admin refund action.",
        refund_status: "completed",
        refund_txid: refund.txid ?? refund.paymentId,
        refund_amount_pi: amountPi,
        resolved_at: now,
        updated_at: now,
      })
      .eq("id", disputeId);

    await supabase
      .from("orders")
      .update({ status: "refunded", updated_at: now })
      .eq("id", order.id);

    // Compatible with newer schema; fallback keeps old deployments working.
    const earningsRes = await supabase
      .from("seller_earnings")
      .update({ status: "refunded", updated_at: now })
      .eq("order_id", order.id)
      .in("status", ["escrow", "pending", "paid"]);
    if ((earningsRes as any)?.error?.code === "23514") {
      await supabase
        .from("seller_earnings")
        .update({ status: "cancelled", updated_at: now })
        .eq("order_id", order.id)
        .in("status", ["escrow", "pending", "paid"]);
    }

    await supabase
      .from("transactions")
      .update({ status: "refunded" })
      .eq("reference_id", order.id)
      .eq("status", "completed");

    await supabase.from("dispute_audit_logs").insert({
      platform: "market",
      dispute_id: disputeId,
      order_id: order.id,
      actor_type: "admin",
      actor_id: auth.userId,
      event_type: "refund_issued",
      from_status: order.status ?? "disputed",
      to_status: "refunded",
      decision: "refund",
      confidence: null,
      reason_excerpt: "Admin ruled in buyer's favour and issued A2U refund.",
      metadata: {
        action: "refund_issued",
        a2u_payment_id: refund.paymentId,
        a2u_txid: refund.txid,
        amount_pi: amountPi,
        related_transactions: txRows ?? [],
      },
      created_at: now,
    });

    await logAdminAction({
      adminUserId: auth.userId,
      action: "market_dispute_refund_issue",
      targetType: "dispute",
      targetId: disputeId,
      detail: { order_id: order.id, amount_pi: amountPi, txid: refund.txid ?? refund.paymentId },
    });

    // Notification (best effort): email buyer and seller if available.
    if (buyer.email) {
      await sendPlatformEmail({
        to: buyer.email,
        subject: "Dispute Resolved — Refund Approved",
        html: `
          <p>Your dispute for Order #${order.id} has been resolved. ${amountPi.toFixed(2)}π has been sent back to your Pi wallet.</p>
        `,
      });
    }
    if (seller?.email) {
      await sendPlatformEmail({
        to: seller.email,
        subject: "Dispute Updated — Refund Issued",
        html: `
          <p>Order #${order.id.slice(0, 8)} dispute has been resolved in buyer's favour.</p>
          <p>Refund amount: <strong>${amountPi.toFixed(2)}π</strong>.</p>
        `,
      });
    }

    return NextResponse.json({
      success: true,
      refund: {
        dispute_id: disputeId,
        order_id: order.id,
        amount_pi: amountPi,
        paymentId: refund.paymentId,
        txid: refund.txid ?? refund.paymentId,
      },
    });
  } catch (error: any) {
    await supabase
      .from("disputes")
      .update({
        refund_status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", disputeId);

    return NextResponse.json(
      { success: false, error: error?.message ?? "Failed to issue A2U refund" },
      { status: 500 }
    );
  }
}

