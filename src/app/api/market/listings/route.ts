import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q          = searchParams.get("q") ?? "";
  const category   = searchParams.get("category") ?? "";
  const country    = searchParams.get("country") ?? "MY";
  const sort       = searchParams.get("sort") ?? "newest";
  const minPrice   = searchParams.get("min_price");
  const maxPrice   = searchParams.get("max_price");
  const page       = parseInt(searchParams.get("page") ?? "1");
  const limit      = parseInt(searchParams.get("limit") ?? "20");
  const offset     = (page - 1) * limit;

  const supabase = await createClient();

  let query = supabase
    .from("listings")
    .select(`
      id, title, price_pi, category, images, status, stock, views,
      country_code, ship_worldwide, created_at,
      seller:seller_id(id, username, display_name, avatar_url, kyc_status)
    `, { count: "exact" })
    .eq("status", "active")
    .gt("stock", 0);

  // Country filter
  if (country === "WORLDWIDE") {
    query = query.eq("ship_worldwide", true);
  } else {
    // Show local listings + worldwide listings
    query = query.or(`country_code.eq.${country},ship_worldwide.eq.true`);
  }

  if (q)        query = query.ilike("title", `%${q}%`);
  if (category) query = query.eq("category", category);
  if (minPrice) query = query.gte("price_pi", parseFloat(minPrice));
  if (maxPrice) query = query.lte("price_pi", parseFloat(maxPrice));

  // Sort
  switch (sort) {
    case "price_asc":  query = query.order("price_pi", { ascending: true });  break;
    case "price_desc": query = query.order("price_pi", { ascending: false }); break;
    case "popular":    query = query.order("views",    { ascending: false }); break;
    default:           query = query.order("created_at", { ascending: false });
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    data: { listings: data ?? [], total: count ?? 0, page, limit }
  });
}