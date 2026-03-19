import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.market.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page      = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const q         = searchParams.get("q") ?? "";
  const status    = searchParams.get("status") ?? "";
  const category  = searchParams.get("category") ?? "";
  const limit     = 20;
  const offset    = (page - 1) * limit;

  const supabase = await createAdminClient();
  let query = supabase
    .from("listings")
    .select("id, title, price_pi, category, status, stock, views, created_at, images, seller_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status)   query = query.eq("status", status);
  if (category) query = query.eq("category", category);
  if (q)        query = query.or(`title.ilike.%${q}%`);

  const { data: rows, count, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const listings = rows ?? [];
  if (listings.length === 0) {
    return NextResponse.json({ success: true, data: { listings: [], total: count ?? 0, page, limit } });
  }

  const sellerIds = [...new Set(listings.map((r: { seller_id: string }) => r.seller_id))];
  const { data: users } = await supabase
    .from("users")
    .select("id, username, display_name, avatar_url, kyc_status, is_banned")
    .in("id", sellerIds);

  const userMap = new Map((users ?? []).map((u: { id: string }) => [u.id, u]));
  const listingsWithSeller = listings.map((r: Record<string, unknown>) => {
    const { seller_id, ...rest } = r;
    const fallbackSeller = {
      id: String(seller_id ?? ""),
      username: "unknown",
      display_name: null,
      avatar_url: null,
      kyc_status: "unverified",
      is_banned: false,
    };
    const seller = userMap.get(seller_id as string) ?? fallbackSeller;
    const safeUsername = String((seller as { username?: string }).username ?? "").trim() || "unknown";
    return { ...rest, seller: { ...seller, username: safeUsername } };
  });

  return NextResponse.json({ success: true, data: { listings: listingsWithSeller, total: count ?? 0, page, limit } });
}