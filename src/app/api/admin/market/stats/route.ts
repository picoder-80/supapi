import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });

  const supabase = await createAdminClient();

  const [
    { count: totalListings },
    { count: activeListings },
    { count: totalOrders },
    { count: pendingOrders },
    { count: completedOrders },
    { count: disputedOrders },
    { data: revenueData },
    { data: commissionData },
    { data: recentOrders },
    { data: configData },
  ] = await Promise.all([
    supabase.from("listings").select("*", { count: "exact", head: true }).neq("status","deleted"),
    supabase.from("listings").select("*", { count: "exact", head: true }).eq("status","active"),
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status","pending"),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status","completed"),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status","disputed"),
    supabase.from("orders").select("amount_pi").eq("status","completed"),
    supabase.from("commissions").select("commission_pi").eq("status","collected"),
    supabase.from("orders")
      .select("id, status, amount_pi, created_at, buying_method, listing:listing_id(title), buyer:buyer_id(username)")
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("platform_config").select("value").eq("key","market_commission_pct").single(),
  ]);

  const totalRevenuePi  = revenueData?.reduce((s, o) => s + Number(o.amount_pi), 0) ?? 0;
  const totalCommission = commissionData?.reduce((s, c) => s + Number(c.commission_pi), 0) ?? 0;
  const commissionPct   = parseFloat(configData?.value ?? "5");

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