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
    .select(`
      id, title, price_pi, category, status, stock, views, created_at, images, seller_id,
      seller:seller_id ( id, username, display_name, avatar_url, kyc_status, is_banned )
    `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status)   query = query.eq("status", status);
  if (category) query = query.eq("category", category);
  if (q)        query = query.or(`title.ilike.%${q}%`);

  let rows: Record<string, unknown>[] | null = null;
  let count: number | null = 0;
  let error: { message?: string } | null = null;
  {
    const res = await query;
    rows = (res.data as Record<string, unknown>[] | null) ?? null;
    count = res.count ?? 0;
    error = (res.error as { message?: string } | null) ?? null;
  }

  // Compatibility fallback: some deployments may not support nested seller relation shape yet.
  if (error) {
    let legacyQuery = supabase
      .from("listings")
      .select("id, title, price_pi, category, status, stock, views, created_at, images, seller_id", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (status) legacyQuery = legacyQuery.eq("status", status);
    if (category) legacyQuery = legacyQuery.eq("category", category);
    if (q) legacyQuery = legacyQuery.or(`title.ilike.%${q}%`);

    const legacy = await legacyQuery;
    if (legacy.error) {
      return NextResponse.json({ success: false, error: legacy.error.message }, { status: 500 });
    }
    rows = (legacy.data as Record<string, unknown>[] | null) ?? null;
    count = legacy.count ?? 0;
  }

  const listings = rows ?? [];
  if (listings.length === 0) {
    return NextResponse.json({ success: true, data: { listings: [], total: count ?? 0, page, limit } });
  }

  const sellerIds = [...new Set(listings.map((r) => String(r.seller_id ?? "")).filter(Boolean))];
  let userMap = new Map<string, Record<string, unknown>>();
  if (sellerIds.length > 0) {
    const usersRes = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url, kyc_status, is_banned")
      .in("id", sellerIds);
    // If is_banned is missing on older schema, retry without it.
    if (usersRes.error) {
      const usersLegacy = await supabase
        .from("users")
        .select("id, username, display_name, avatar_url, kyc_status")
        .in("id", sellerIds);
      userMap = new Map(
        (usersLegacy.data ?? []).map((u: Record<string, unknown>) => [
          String(u.id ?? ""),
          { ...u, is_banned: false },
        ])
      );
    } else {
      userMap = new Map((usersRes.data ?? []).map((u: Record<string, unknown>) => [String(u.id ?? ""), u]));
    }
  }

  const listingsWithSeller = listings.map((r: Record<string, unknown>) => {
    const sellerId = String(r.seller_id ?? "");
    const currentSeller = (r.seller as Record<string, unknown> | null) ?? userMap.get(sellerId) ?? null;
    const fallbackSeller = {
      id: sellerId,
      username: "unknown",
      display_name: null,
      avatar_url: null,
      kyc_status: "unverified",
      is_banned: false,
    };
    const seller = currentSeller ?? fallbackSeller;
    const safeUsername = String((seller as { username?: string }).username ?? "").trim() || "unknown";
    return { ...r, seller: { ...seller, username: safeUsername } };
  });

  return NextResponse.json({ success: true, data: { listings: listingsWithSeller, total: count ?? 0, page, limit } });
}