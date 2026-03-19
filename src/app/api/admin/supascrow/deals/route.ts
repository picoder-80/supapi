import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.supascrow.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "";
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));

  let query = supabase
    .from("supascrow_deals")
    .select("id, title, amount_pi, currency, status, buyer_id, seller_id, tracking_number, tracking_carrier, created_at, updated_at, released_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);

  const [
    { data: deals, error, count },
    { data: summaryRows },
    { count: openDisputesCount },
  ] = await Promise.all([
    query,
    supabase.from("supascrow_deals").select("status, amount_pi, currency"),
    supabase
      .from("supascrow_disputes")
      .select("id", { count: "exact", head: true })
      .or("resolution.is.null,resolution.eq.pending"),
  ]);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const partyIds = [...new Set((deals ?? []).flatMap((d: { buyer_id: string; seller_id: string }) => [d.buyer_id, d.seller_id]))];
  const { data: users } = await supabase.from("users").select("id, username, display_name").in("id", partyIds);
  const userMap = new Map((users ?? []).map((u: { id: string }) => [u.id, u]));

  const enriched = (deals ?? []).map((d: { buyer_id: string; seller_id: string }) => ({
    ...d,
    buyer: userMap.get(d.buyer_id) ?? { id: d.buyer_id, username: "?", display_name: null },
    seller: userMap.get(d.seller_id) ?? { id: d.seller_id, username: "?", display_name: null },
  }));

  const byStatus: Record<string, number> = {};
  let totalEscrowPi = 0;
  let fundedEscrowPi = 0;
  let releasedEscrowPi = 0;
  let refundedEscrowPi = 0;
  for (const row of summaryRows ?? []) {
    const statusKey = String((row as { status?: string }).status ?? "unknown");
    byStatus[statusKey] = (byStatus[statusKey] ?? 0) + 1;

    const amount = Number((row as { amount_pi?: number }).amount_pi ?? 0);
    const currency = String((row as { currency?: string }).currency ?? "pi");
    if (currency === "pi") {
      totalEscrowPi += amount;
      if (statusKey === "funded") fundedEscrowPi += amount;
      if (statusKey === "released") releasedEscrowPi += amount;
      if (statusKey === "refunded") refundedEscrowPi += amount;
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      deals: enriched,
      total: count ?? 0,
      summary: {
        total_deals: count ?? 0,
        open_disputes: openDisputesCount ?? 0,
        status_counts: byStatus,
        total_escrow_pi: Number(totalEscrowPi.toFixed(4)),
        funded_escrow_pi: Number(fundedEscrowPi.toFixed(4)),
        released_escrow_pi: Number(releasedEscrowPi.toFixed(4)),
        refunded_escrow_pi: Number(refundedEscrowPi.toFixed(4)),
      },
    },
  });
}
