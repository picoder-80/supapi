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

  const { data: deals, error, count } = await query;

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const partyIds = [...new Set((deals ?? []).flatMap((d: { buyer_id: string; seller_id: string }) => [d.buyer_id, d.seller_id]))];
  const { data: users } = await supabase.from("users").select("id, username, display_name").in("id", partyIds);
  const userMap = new Map((users ?? []).map((u: { id: string }) => [u.id, u]));

  const enriched = (deals ?? []).map((d: { buyer_id: string; seller_id: string }) => ({
    ...d,
    buyer: userMap.get(d.buyer_id) ?? { id: d.buyer_id, username: "?", display_name: null },
    seller: userMap.get(d.seller_id) ?? { id: d.seller_id, username: "?", display_name: null },
  }));

  return NextResponse.json({
    success: true,
    data: { deals: enriched, total: count ?? 0 },
  });
}
