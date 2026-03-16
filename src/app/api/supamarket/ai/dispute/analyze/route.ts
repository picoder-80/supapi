import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";
import { analyzeDispute } from "@/lib/market/ai";

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const orderId = String(body?.order_id ?? "").trim();
    const reason = String(body?.reason ?? "").trim();
    const evidence = Array.isArray(body?.evidence) ? body.evidence.map(String) : [];

    if (!orderId || !reason) {
      return NextResponse.json({ success: false, error: "order_id and reason are required" }, { status: 400 });
    }

    const supabase = await createAdminClient();
    const { data: order } = await supabase
      .from("orders")
      .select("id, buyer_id, seller_id, status, buying_method, amount_pi")
      .eq("id", orderId)
      .single();

    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    if (order.buyer_id !== payload.userId && order.seller_id !== payload.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized for this order" }, { status: 403 });
    }

    const result = await analyzeDispute({
      reason,
      evidence,
      buying_method: order.buying_method,
      order_status: order.status,
      amount_pi: Number(order.amount_pi ?? 0),
    });

    return NextResponse.json({
      success: true,
      data: {
        order_id: orderId,
        ...result,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
