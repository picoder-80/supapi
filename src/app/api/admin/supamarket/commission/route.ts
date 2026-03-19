import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

// GET commission config + summary (uses admin_revenue — same source as Treasury/stats)
export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.market.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createAdminClient();
  const [
    { data: config },
    { data: revenue },
    { data: allRevenue },
    { data: completedOrders },
    { data: pendingEscrowRows },
    { data: openOrdersRows },
  ] = await Promise.all([
    supabase.from("platform_config").select("*").eq("key", "market_commission_pct").maybeSingle(),
    supabase.from("admin_revenue").select("commission_pi, created_at").eq("platform", "market").order("created_at", { ascending: false }).limit(50),
    supabase.from("admin_revenue").select("commission_pi").eq("platform", "market"),
    supabase
      .from("orders")
      .select("id, amount_pi, price_pi, commission_pi, commission_pct")
      .eq("status", "completed")
      .not("listing_id", "is", null),
    supabase
      .from("seller_earnings")
      .select("commission_pi")
      .eq("platform", "market")
      .eq("status", "escrow"),
    supabase
      .from("orders")
      .select("id, amount_pi, price_pi, commission_pi, commission_pct")
      .in("status", ["paid", "escrow", "delivered"])
      .not("listing_id", "is", null),
  ]);

  const commissionPct = parseFloat(config?.value ?? "5");
  const totalFromRevenue = allRevenue?.reduce((s, r) => s + Number(r.commission_pi ?? 0), 0) ?? 0;
  const hasRevenueRows = Boolean((allRevenue ?? []).length);
  const totalCollected = hasRevenueRows
    ? totalFromRevenue
    : (completedOrders ?? []).reduce((s, o) => {
        const gross = Number(o.amount_pi ?? o.price_pi ?? 0);
        const c = Number(o.commission_pi ?? 0);
        const pct = Number(o.commission_pct ?? commissionPct);
        return s + (c > 0 ? c : gross * (pct / 100));
      }, 0);
  const pendingFromEscrow = (pendingEscrowRows ?? []).reduce((s, r) => s + Number(r.commission_pi ?? 0), 0);
  const totalPending = pendingFromEscrow > 0
    ? pendingFromEscrow
    : (openOrdersRows ?? []).reduce((s, o) => {
        const gross = Number(o.amount_pi ?? o.price_pi ?? 0);
        const c = Number(o.commission_pi ?? 0);
        const pct = Number(o.commission_pct ?? commissionPct);
        return s + (c > 0 ? c : gross * (pct / 100));
      }, 0);
  const ledger = (revenue ?? []).map((r) => ({
    commission_pi: r.commission_pi,
    status: "collected",
    created_at: r.created_at,
  }));

  return NextResponse.json({
    success: true,
    data: {
      commission_pct: commissionPct,
      total_collected_pi: totalCollected,
      total_pending_pi: totalPending,
      ledger,
    },
  });
}

// PATCH — update commission %
export async function PATCH(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.market.write")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { commission_pct } = await req.json();
  if (commission_pct === undefined || commission_pct < 0 || commission_pct > 50)
    return NextResponse.json({ success: false, error: "Invalid commission (0-50%)" }, { status: 400 });

  const supabase = await createAdminClient();
  const val = String(commission_pct);
  const now = new Date().toISOString();
  await Promise.all([
    supabase.from("platform_config").upsert(
      { key: "market_commission_pct", value: val, updated_at: now },
      { onConflict: "key" }
    ),
    supabase.from("platform_config").upsert(
      { key: "commission_market", value: val, updated_at: now },
      { onConflict: "key" }
    ),
  ]);

  return NextResponse.json({ success: true, data: { commission_pct } });
}