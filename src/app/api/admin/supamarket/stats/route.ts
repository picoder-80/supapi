import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.market.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createAdminClient();

  const [
    { count: totalListings },
    { count: activeListings },
    { count: totalOrders },
    { count: pendingOrders },
    { count: completedOrders },
    { count: disputedOrders },
    { data: revenueData },
    { data: adminRevenue },
    { data: completedOrdersData },
    { data: recentOrders },
    { data: configData },
  ] = await Promise.all([
    supabase.from("listings").select("*", { count: "exact", head: true }).neq("status","removed"),
    supabase.from("listings").select("*", { count: "exact", head: true }).eq("status","active"),
    supabase.from("orders").select("*", { count: "exact", head: true }).not("listing_id", "is", null),
    supabase.from("orders").select("*", { count: "exact", head: true }).not("listing_id", "is", null).eq("status","pending"),
    supabase.from("orders").select("*", { count: "exact", head: true }).not("listing_id", "is", null).eq("status","completed"),
    supabase.from("orders").select("*", { count: "exact", head: true }).not("listing_id", "is", null).eq("status","disputed"),
    supabase.from("orders").select("amount_pi, price_pi").eq("status","completed").not("listing_id", "is", null),
    supabase.from("admin_revenue").select("commission_pi, order_id").eq("platform", "market"),
    supabase.from("orders").select("id, amount_pi, price_pi, commission_pi, commission_pct").not("listing_id", "is", null).eq("status","completed"),
    supabase.from("orders")
      .select("id, status, amount_pi, created_at, buying_method, listing:listing_id(title), buyer:buyer_id(username)")
      .not("listing_id", "is", null)
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("platform_config").select("value").eq("key","market_commission_pct").maybeSingle(),
  ]);

  const totalRevenuePi = revenueData?.reduce((s, o) => s + Number(o.amount_pi ?? o.price_pi ?? 0), 0) ?? 0;
  const commissionPct = parseFloat(configData?.value ?? "5");

  // Actual commission — same source as Treasury (admin_revenue + orders fallback)
  const revenueOrderIds = new Set((adminRevenue ?? []).map((r: { order_id?: string }) => String(r.order_id ?? "")).filter(Boolean));
  let totalCommission = (adminRevenue ?? []).reduce((s: number, r: { commission_pi?: number }) => s + parseFloat(String(r.commission_pi ?? 0)), 0);
  (completedOrdersData ?? []).forEach((o: { id: string; commission_pi?: number; amount_pi?: number; price_pi?: number; commission_pct?: number }) => {
    if (revenueOrderIds.has(String(o.id))) return;
    const gross = parseFloat(String(o.amount_pi ?? o.price_pi ?? 0));
    const c = parseFloat(String(o.commission_pi ?? 0));
    const pct = parseFloat(String(o.commission_pct ?? commissionPct));
    totalCommission += c > 0 ? c : gross * (pct / 100);
  });

  return NextResponse.json({
    success: true,
    data: {
      listings: { total: totalListings ?? 0, active: activeListings ?? 0 },
      orders: {
        total: totalOrders ?? 0, pending: pendingOrders ?? 0,
        completed: completedOrders ?? 0, disputed: disputedOrders ?? 0,
      },
      revenue: {
        total_pi: totalRevenuePi,
        commission_pi: totalCommission,
        commission_pct: commissionPct,
        estimated_commission: totalRevenuePi * (commissionPct / 100),
      },
      recent_orders: recentOrders ?? [],
    }
  });
}