import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";

type Params = { params: Promise<{ id: string }> };

// Admin can force any status
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });

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
  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", id).select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}