import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

const CONFIG_KEY = "commission_supascrow";
const DEFAULT_PCT = 5;

// GET commission config + total from admin_revenue
export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.supascrow.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createAdminClient();
  const [{ data: config }, { data: revenue }] = await Promise.all([
    supabase.from("platform_config").select("*").eq("key", CONFIG_KEY).maybeSingle(),
    supabase.from("admin_revenue").select("commission_pi").eq("platform", "supascrow"),
  ]);

  const totalCommission = revenue?.reduce((s, r) => s + Number(r.commission_pi ?? 0), 0) ?? 0;

  return NextResponse.json({
    success: true,
    data: {
      commission_pct: parseFloat(config?.value ?? String(DEFAULT_PCT)),
      total_commission_pi: totalCommission,
    },
  });
}

// PATCH — update commission %
export async function PATCH(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.supascrow.write")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { commission_pct } = await req.json().catch(() => ({}));
  if (commission_pct === undefined || commission_pct < 0 || commission_pct > 50) {
    return NextResponse.json({ success: false, error: "Invalid commission (0-50%)" }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const { error } = await supabase.from("platform_config").upsert(
    {
      key: CONFIG_KEY,
      value: String(commission_pct),
      description: "SupaScrow commission % (deducted from seller payout on Pi release)",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data: { commission_pct } });
}
