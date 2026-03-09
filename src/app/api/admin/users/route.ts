import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q       = searchParams.get("q") ?? "";
  const page    = parseInt(searchParams.get("page") ?? "1");
  const filter  = searchParams.get("filter") ?? ""; // banned | sellers
  const limit   = 20;

  const supabase = await createAdminClient();
  let query = supabase
    .from("users")
    .select("id, username, display_name, avatar_url, kyc_status, role, is_banned, ban_reason, seller_verified, created_at, last_seen", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page-1)*limit, page*limit - 1);

  if (q)                 query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
  if (filter === "banned") query = query.eq("is_banned", true);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data: { users: data ?? [], total: count ?? 0, page } });
}