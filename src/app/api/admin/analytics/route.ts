// app/api/admin/analytics/route.ts

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getTokenFromRequest } from "@/lib/auth/session";
import * as R from "@/lib/api";

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload || payload.role !== "admin") return R.unauthorized();

  const supabase = await createAdminClient();

  const now      = new Date();
  const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const last30   = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalUsers },
    { count: newUsersToday },
    { count: newUsersMonth },
    { count: totalListings },
    { count: activeListings },
    { count: totalOrders },
    { count: disputedOrders },
    { data: revenueData },
    { data: dailySignups },
    { data: topCategories },
  ] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("users").select("*", { count: "exact", head: true }).gte("created_at", today),
    supabase.from("users").select("*", { count: "exact", head: true }).gte("created_at", thisMonth),
    supabase.from("listings").select("*", { count: "exact", head: true }),
    supabase.from("listings").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "disputed"),
    supabase.from("transactions")
      .select("amount_pi")
      .eq("status", "completed")
      .gte("created_at", last30),
    // Daily signups last 7 days
    supabase.rpc("get_daily_signups").limit(7),
    // Top listing categories
    supabase.from("listings")
      .select("category")
      .eq("status", "active")
      .limit(100),
  ]);

  // Calculate GMV (gross merchandise value)
  const gmv30d = (revenueData ?? []).reduce(
    (sum: number, t: { amount_pi: number }) => sum + (t.amount_pi ?? 0), 0
  );

  // Platform fee (5% of GMV)
  const platformRevenue30d = gmv30d * 0.05;

  // Category breakdown
  const catCount: Record<string, number> = {};
  (topCategories ?? []).forEach((l: { category: string }) => {
    catCount[l.category] = (catCount[l.category] ?? 0) + 1;
  });
  const categoryBreakdown = Object.entries(catCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return R.ok({
    overview: {
      totalUsers:         totalUsers      ?? 0,
      newUsersToday:      newUsersToday   ?? 0,
      newUsersMonth:      newUsersMonth   ?? 0,
      totalListings:      totalListings   ?? 0,
      activeListings:     activeListings  ?? 0,
      totalOrders:        totalOrders     ?? 0,
      disputedOrders:     disputedOrders  ?? 0,
      gmv30d:             parseFloat(gmv30d.toFixed(2)),
      platformRevenue30d: parseFloat(platformRevenue30d.toFixed(2)),
    },
    dailySignups:      dailySignups      ?? [],
    categoryBreakdown,
  });
}
