import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

// GET commission config + summary
export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.market.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createAdminClient();
  const [{ data: config }, { data: ledger }] = await Promise.all([
    supabase.from("platform_config").select("*").eq("key","market_commission_pct").single(),
    supabase.from("commissions").select("commission_pi, status, created_at").order("created_at", { ascending: false }).limit(50),
  ]);

  const totalCollected = ledger?.filter(c => c.status === "collected").reduce((s,c) => s + Number(c.commission_pi), 0) ?? 0;
  const totalPending   = ledger?.filter(c => c.status === "pending").reduce((s,c) => s + Number(c.commission_pi), 0) ?? 0;

  return NextResponse.json({ success: true, data: {
    commission_pct: parseFloat(config?.value ?? "5"),
    total_collected_pi: totalCollected,
    total_pending_pi: totalPending,
    ledger: ledger ?? [],
  }});
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