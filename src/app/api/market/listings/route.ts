// src/app/api/market/listings/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getUserId(req: NextRequest): string | null {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return String(decoded.userId ?? decoded.id ?? decoded.sub ?? "");
  } catch { return null; }
}

const PACKAGES: Record<string, number> = {
  starter: 100, popular: 500, pro: 1000, whale: 5000,
};

// ── POST: Create listing ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, description, price_pi, category, subcategory,
          condition, buying_method, location, stock, type,
          images, country_code, ship_worldwide } = body;

  if (!title?.trim())    return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
  if (!category?.trim()) return NextResponse.json({ success: false, error: "Category is required" }, { status: 400 });
  if (!price_pi || parseFloat(price_pi) <= 0)
    return NextResponse.json({ success: false, error: "Valid price is required" }, { status: 400 });

  const { data: seller } = await supabase
    .from("users")
    .select("id, username, display_name, avatar_url")
    .eq("id", userId)
    .single();

  const { data, error } = await supabase
    .from("market_listings")
    .insert({
      seller_id:      userId,
      seller_name:    seller?.display_name ?? seller?.username ?? "Pioneer",
      title:          title.trim(),
      description:    description?.trim() ?? "",
      price_pi:       parseFloat(price_pi),
      category:       category.trim(),
      subcategory:    subcategory?.trim() ?? "",
      condition:      condition ?? "new",
      buying_method:  buying_method ?? "both",
      location:       location?.trim() ?? "",
      stock:          parseInt(stock ?? "1") || 1,
      type:           type ?? "physical",
      images:         images ?? [],
      cover_image:    images?.[0] ?? null,
      country_code:   country_code ?? "MY",
      ship_worldwide: ship_worldwide ?? false,
      status:         "active",
    })
    .select()
    .single();

  if (error) {
    console.error("[market/listings POST]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Award SC for first listing (one-time)
  try {
    const { data: existing } = await supabase
      .from("credit_transactions")
      .select("id").eq("user_id", userId).eq("activity", "first_listing").maybeSingle();
    if (!existing) {
      const { data: wallet } = await supabase
        .from("supapi_credits").select("balance, total_earned").eq("user_id", userId).single();
      if (wallet) {
        const newBalance = wallet.balance + 50;
        await supabase.from("supapi_credits")
          .update({ balance: newBalance, total_earned: wallet.total_earned + 50 }).eq("user_id", userId);
        await supabase.from("credit_transactions").insert({
          user_id: userId, type: "earn", activity: "first_listing",
          amount: 50, balance_after: newBalance, note: "🎉 First listing bonus",
        });
      }
    }
  } catch {}

  return NextResponse.json({ success: true, data });
}

// ── GET: Fetch listings with { listings, total } ──────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q           = searchParams.get("q");
  const category    = searchParams.get("category");
  const subcategory = searchParams.get("subcategory");
  const condition   = searchParams.get("condition");
  const method      = searchParams.get("method");
  const sort        = searchParams.get("sort") ?? "newest";
  const country     = searchParams.get("country") ?? "MY";
  const seller_id   = searchParams.get("seller_id");
  const page        = parseInt(searchParams.get("page") ?? "1");
  const limit       = 20;

  try {
    let query = supabase
      .from("market_listings")
      .select(`
        id, title, price_pi, images, category, subcategory, condition,
        buying_method, location, view_count, created_at, country_code, ship_worldwide,
        seller_id, seller_name
      `, { count: "exact" })
      .eq("status", "active");

    // Filters
    if (category)    query = query.eq("category", category);
    if (subcategory) query = query.eq("subcategory", subcategory);
    if (condition)   query = query.eq("condition", condition);
    if (method)      query = query.eq("buying_method", method);
    if (seller_id)   query = query.eq("seller_id", seller_id);
    if (q)           query = query.ilike("title", `%${q}%`);

    // Country filter
    if (country && country !== "WORLDWIDE") {
      query = query.or(`country_code.eq.${country},ship_worldwide.eq.true`);
    }

    // Sort
    if (sort === "price_asc")  query = query.order("price_pi", { ascending: true });
    else if (sort === "price_desc") query = query.order("price_pi", { ascending: false });
    else if (sort === "popular") query = query.order("view_count", { ascending: false });
    else query = query.order("created_at", { ascending: false }); // newest

    // Pagination
    query = query.range((page - 1) * limit, page * limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    // Enrich with seller info
    const sellerIds = [...new Set((data ?? []).map((l: any) => l.seller_id))];
    let sellersMap: Record<string, any> = {};
    if (sellerIds.length > 0) {
      const { data: sellers } = await supabase
        .from("users")
        .select("id, username, display_name, avatar_url, kyc_status")
        .in("id", sellerIds);
      (sellers ?? []).forEach((s: any) => { sellersMap[s.id] = s; });
    }

    const listings = (data ?? []).map((l: any) => ({
      ...l,
      views: l.view_count ?? 0,
      likes: 0,
      seller: sellersMap[l.seller_id] ?? { id: l.seller_id, username: l.seller_name, display_name: l.seller_name, avatar_url: null, kyc_status: "unverified" },
    }));

    return NextResponse.json({
      success: true,
      data: { listings, total: count ?? 0 },
    });
  } catch (err: any) {
    console.error("[market/listings GET]", err);
    return NextResponse.json({
      success: true,
      data: { listings: [], total: 0 },
    });
  }
}
