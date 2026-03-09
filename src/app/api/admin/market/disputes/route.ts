import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "";
  const page   = parseInt(searchParams.get("page") ?? "1");
  const limit  = 20;

  const supabase = await createAdminClient();
  let query = supabase
    .from("disputes")
    .select(`id, reason, status, ai_decision, ai_reasoning, ai_confidence, created_at, resolved_at,
      opened_by_user:opened_by(id, username, display_name, avatar_url),
      order:order_id(id, amount_pi, status, buyer:buyer_id(username), seller:seller_id(username), listing:listing_id(title))`,
      { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page-1)*limit, page*limit - 1);

  if (status) query = query.eq("status", status);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data: { disputes: data ?? [], total: count ?? 0 } });
}