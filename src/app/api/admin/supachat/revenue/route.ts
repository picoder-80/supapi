import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.treasury.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createAdminClient();
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "all";

  let fromDate: string | null = null;
  if (period === "month") {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    fromDate = d.toISOString();
  } else if (period === "week") {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    fromDate = d.toISOString();
  }

  let revenueQuery = supabase
    .from("supachat_revenue")
    .select("id,type,source_id,amount_pi,created_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (fromDate) revenueQuery = revenueQuery.gte("created_at", fromDate);

  const [{ data: revenueRows }, { data: activeBadges }, { data: activePromotions }, { data: rooms }] =
    await Promise.all([
      revenueQuery,
      supabase.from("supachat_verified_badges").select("id", { count: "exact" }).gt("expires_at", new Date().toISOString()),
      supabase.from("supachat_promotions").select("id", { count: "exact" }).gt("ends_at", new Date().toISOString()),
      supabase.from("supachat_rooms").select("id,name,is_promoted"),
    ]);

  const byType: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  (revenueRows ?? []).forEach((row: any) => {
    const amount = Number(row.amount_pi ?? 0);
    byType[row.type] = (byType[row.type] ?? 0) + amount;
    const day = String(row.created_at).slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + amount;
  });
  const totalPi = Object.values(byType).reduce((s, v) => s + v, 0);

  const roomRevenueMap: Record<string, number> = {};
  (revenueRows ?? []).forEach((row: any) => {
    if (!row.source_id) return;
    roomRevenueMap[row.source_id] = (roomRevenueMap[row.source_id] ?? 0) + Number(row.amount_pi ?? 0);
  });
  const roomNameById = Object.fromEntries((rooms ?? []).map((r: any) => [r.id, r.name]));
  const topRooms = Object.entries(roomRevenueMap)
    .map(([id, amount]) => ({ room_id: id, room_name: roomNameById[id] ?? "Unknown Room", amount_pi: amount }))
    .sort((a, b) => b.amount_pi - a.amount_pi)
    .slice(0, 10);

  return NextResponse.json({
    success: true,
    data: {
      period,
      total_pi: Number(totalPi.toFixed(7)),
      by_type: Object.fromEntries(
        Object.entries(byType).map(([k, v]) => [k, Number(v.toFixed(7))])
      ),
      by_day: byDay,
      top_rooms: topRooms,
      active_verified_badges: activeBadges?.length ?? 0,
      active_promotions: activePromotions?.length ?? 0,
    },
  });
}
