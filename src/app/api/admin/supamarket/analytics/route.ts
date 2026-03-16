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

  // Orders per day (last 30 days) — manual query
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentOrders } = await supabase
    .from("orders")
    .select("status, amount_pi, created_at")
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: true });

  // Group by day manually
  const dayMap: Record<string, { orders: number; revenue: number; completed: number }> = {};
  for (const o of recentOrders ?? []) {
    const day = o.created_at.slice(0, 10);
    if (!dayMap[day]) dayMap[day] = { orders: 0, revenue: 0, completed: 0 };
    dayMap[day].orders++;
    if (o.status === "completed") { dayMap[day].revenue += Number(o.amount_pi); dayMap[day].completed++; }
  }

  // Fill missing days
  const days: { date: string; orders: number; revenue: number; completed: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    days.push({ date: d, ...(dayMap[d] ?? { orders: 0, revenue: 0, completed: 0 }) });
  }

  // Category breakdown
  const { data: catData } = await supabase
    .from("listings")
    .select("category")
    .neq("status", "removed");
  const catMap: Record<string, number> = {};
  for (const l of catData ?? []) { catMap[l.category] = (catMap[l.category] ?? 0) + 1; }
  const categories = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  // Order status breakdown
  const { data: statusData } = await supabase.from("orders").select("status");
  const statusMap: Record<string, number> = {};
  for (const o of statusData ?? []) { statusMap[o.status] = (statusMap[o.status] ?? 0) + 1; }
  const statuses = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

  // Top sellers
  const { data: topSellers } = await supabase
    .from("orders")
    .select("seller_id, amount_pi, seller:seller_id(username, display_name, avatar_url)")
    .eq("status", "completed");
  const sellerMap: Record<string, { total: number; count: number; info: any }> = {};
  for (const o of topSellers ?? []) {
    if (!sellerMap[o.seller_id]) sellerMap[o.seller_id] = { total: 0, count: 0, info: o.seller };
    sellerMap[o.seller_id].total += Number(o.amount_pi);
    sellerMap[o.seller_id].count++;
  }
  const top_sellers = Object.entries(sellerMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([id, v]) => ({ seller_id: id, ...v }));

  return NextResponse.json({ success: true, data: { days, categories, statuses, top_sellers } });
}