import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page   = parseInt(searchParams.get("page") ?? "1");
  const status = searchParams.get("status") ?? "";
  const q      = searchParams.get("q") ?? "";
  const limit  = 20;
  const offset = (page - 1) * limit;

  const supabase = await createAdminClient();
  let query = supabase
    .from("orders")
    .select(`id, status, amount_pi, buying_method, created_at, updated_at, pi_payment_id,
      listing:listing_id(id, title, images),
      buyer:buyer_id(id, username, display_name, avatar_url),
      seller:seller_id(id, username, display_name, avatar_url)`,
      { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data: { orders: data ?? [], total: count ?? 0, page, limit } });
}