import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/server";
import { getPayment } from "@/lib/pi/payments";
import { hasAdminPermission } from "@/lib/admin/permissions";

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!hasAdminPermission(auth.role, "admin.payments.trace")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const paymentId = String(req.nextUrl.searchParams.get("paymentId") ?? "").trim();
  if (!paymentId) {
    return NextResponse.json({ success: false, error: "Missing paymentId" }, { status: 400 });
  }

  try {
    const supabase = await createAdminClient();
    const [piPayment, txRes, orderRes] = await Promise.all([
      getPayment(paymentId),
      supabase
        .from("transactions")
        .select("id, user_id, amount_pi, status, type, reference_type, reference_id, memo, created_at, updated_at")
        .eq("pi_payment_id", paymentId)
        .maybeSingle(),
      supabase
        .from("orders")
        .select("id, buyer_id, seller_id, listing_id, amount_pi, status, pi_payment_id, created_at, updated_at")
        .eq("pi_payment_id", paymentId)
        .maybeSingle(),
    ]);

    const orderId = String(orderRes.data?.id ?? "");
    const [earningRes, revenueRes] = await Promise.all([
      orderId
        ? supabase
            .from("seller_earnings")
            .select("id, seller_id, order_id, gross_pi, net_pi, commission_pi, status, withdrawal_id, created_at")
            .eq("order_id", orderId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      orderId
        ? supabase
            .from("admin_revenue")
            .select("id, platform, order_id, gross_pi, commission_pi, commission_pct, created_at")
            .eq("order_id", orderId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        payment_id: paymentId,
        pi_payment: piPayment,
        db: {
          transaction: txRes.data ?? null,
          order: orderRes.data ?? null,
          seller_earning: earningRes.data ?? null,
          admin_revenue: revenueRes.data ?? null,
        },
      },
      warnings: piPayment ? [] : ["Pi API returned no payment data (invalid paymentId or PI_API_KEY not configured)."],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
