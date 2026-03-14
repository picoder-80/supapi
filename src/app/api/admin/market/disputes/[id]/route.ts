import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/security/audit";

type Params = { params: Promise<{ id: string }> };

// Admin override dispute decision
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });

  const { decision, reasoning } = await req.json(); // "refund" | "release"
  if (!decision) return NextResponse.json({ success: false, error: "decision required" }, { status: 400 });

  const supabase = await createAdminClient();

  // Get dispute + order
  const { data: dispute } = await supabase.from("disputes").select("*, order:order_id(*)").eq("id", id).single();
  if (!dispute) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  const newOrderStatus = decision === "refund" ? "refunded" : "completed";

  await Promise.all([
    supabase.from("disputes").update({
      ai_decision: decision,
      ai_reasoning: `[Admin Override] ${reasoning ?? "Manual decision by admin"}`,
      status: "resolved",
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", id),
    supabase.from("orders").update({
      status: newOrderStatus,
      updated_at: new Date().toISOString(),
    }).eq("id", dispute.order_id),
  ]);

  if (auth.userId) {
    await logAdminAction({
      adminUserId: auth.userId,
      action: "market_dispute_override",
      targetType: "dispute",
      targetId: id,
      detail: { decision, order_id: dispute.order_id },
    });
  }

  return NextResponse.json({ success: true, data: { decision, order_status: newOrderStatus } });
}