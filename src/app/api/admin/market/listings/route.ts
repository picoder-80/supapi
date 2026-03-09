import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page      = parseInt(searchParams.get("page") ?? "1");
  const q         = searchParams.get("q") ?? "";
  const status    = searchParams.get("status") ?? "";
  const category  = searchParams.get("category") ?? "";
  const limit     = 20;
  const offset    = (page - 1) * limit;

  const supabase = await createAdminClient();
  let query = supabase
    .from("listings")
    .select(`id, title, price_pi, category, status, stock, views, created_at, images,
      seller:seller_id(id, username, display_name, avatar_url, kyc_status, is_banned)`,
      { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status)   query = query.eq("status", status);
  if (category) query = query.eq("category", category);
  if (q)        query = query.or(`title.ilike.%${q}%`);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data: { listings: data ?? [], total: count ?? 0, page, limit } });
}