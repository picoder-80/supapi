import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/security/audit";
import { hasAdminPermission } from "@/lib/admin/permissions";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.market.write")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const execute = Boolean(body?.execute);
    const supabase = await createAdminClient();

    const { data: order } = await supabase
      .from("orders")
      .select("id, status, seller_id")
      .eq("id", id)
      .single();
    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });

    const { data: earning } = await supabase
      .from("seller_earnings")
      .select("id, order_id, seller_id, net_pi, status, platform")
      .eq("order_id", id)
      .eq("status", "escrow")
      .single();
    if (!earning) {
      return NextResponse.json({
        success: false,
        error: "No escrow seller_earnings found for this order",
      }, { status: 400 });
    }

    const sellerId = String(earning.seller_id ?? order.seller_id ?? "");
    const amountPi = Number(earning.net_pi ?? 0);
    if (!sellerId || amountPi <= 0) {
      return NextResponse.json({ success: false, error: "Invalid seller payout data" }, { status: 400 });
    }

    const { data: existingCredit } = await supabase
      .from("earnings_transactions")
      .select("id, created_at, amount_pi, status")
      .eq("user_id", sellerId)
      .eq("type", "market_order")
      .eq("ref_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const walletPayload = {
      action: "credit_earnings",
      target_user_id: sellerId,
      type: "market_order",
      source: "Marketplace Order Completion",
      amount_pi: amountPi,
      status: "available",
      ref_id: id,
      note: `Auto payout for completed order ${id}`,
    };

    if (!execute) {
      return NextResponse.json({
        success: true,
        data: {
          mode: "dry_run",
          order_id: id,
          order_status: order.status,
          escrow_status: earning.status,
          platform: earning.platform,
          would_credit: walletPayload,
          already_credited: Boolean(existingCredit),
          existing_credit: existingCredit ?? null,
        },
      });
    }

    if (existingCredit) {
      return NextResponse.json({
        success: false,
        error: "Order already has a market_order credit transaction",
        data: { existing_credit: existingCredit },
      }, { status: 409 });
    }

    const internalSecret = process.env.INTERNAL_API_SECRET;
    if (!internalSecret) {
      return NextResponse.json({ success: false, error: "INTERNAL_API_SECRET is not configured" }, { status: 500 });
    }

    const response = await fetch(`${req.nextUrl.origin}/api/wallet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": internalSecret,
      },
      body: JSON.stringify(walletPayload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success) {
      return NextResponse.json({
        success: false,
        error: "Wallet credit failed",
        data: { wallet_status: response.status, wallet_response: result },
      }, { status: 502 });
    }

    if (auth.userId) {
      await logAdminAction({
        adminUserId: auth.userId,
        action: "market_order_auto_credit_test_execute",
        targetType: "order",
        targetId: id,
        detail: { seller_id: sellerId, amount_pi: amountPi },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        mode: "execute",
        order_id: id,
        credited: true,
        seller_id: sellerId,
        amount_pi: amountPi,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
