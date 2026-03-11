// src/app/api/market/listings/route.ts
// POST   /api/market/listings  — create new listing
// GET    /api/market/listings  — fetch listings (public, with filters)

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

// ── POST: Create listing ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    title, description, price_pi, category, subcategory,
    condition, buying_method, location, stock, type,
    images, country_code, ship_worldwide,
  } = body;

  // Validation
  if (!title?.trim())    return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
  if (!category?.trim()) return NextResponse.json({ success: false, error: "Category is required" }, { status: 400 });
  if (!price_pi || parseFloat(price_pi) <= 0)
    return NextResponse.json({ success: false, error: "Valid price is required" }, { status: 400 });

  // Get seller info
  const { data: seller } = await supabase
    .from("users")
    .select("id, username, display_name, avatar_url")
    .eq("id", userId)
    .single();

  const { data, error } = await supabase
    .from("market_listings")
    .insert({
      seller_id:     userId,
      seller_name:   seller?.display_name ?? seller?.username ?? "Pioneer",
      title:         title.trim(),
      description:   description?.trim() ?? "",
      price_pi:      parseFloat(price_pi),
      category:      category.trim(),
      subcategory:   subcategory?.trim() ?? "",
      condition:     condition ?? "new",
      buying_method: buying_method ?? "both",
      location:      location?.trim() ?? "",
      stock:         parseInt(stock ?? "1") || 1,
      type:          type ?? "physical",
      images:        images ?? [],
      cover_image:   images?.[0] ?? null,
      country_code:  country_code ?? "MY",
      ship_worldwide: ship_worldwide ?? false,
      status:        "active",
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
      .select("id")
      .eq("user_id", userId)
      .eq("activity", "first_listing")
      .maybeSingle();

    if (!existing) {
      const { data: wallet } = await supabase
        .from("supapi_credits")
        .select("balance, total_earned")
        .eq("user_id", userId)
        .single();

      if (wallet) {
        const newBalance = wallet.balance + 50;
        await supabase.from("supapi_credits")
          .update({ balance: newBalance, total_earned: wallet.total_earned + 50 })
          .eq("user_id", userId);
        await supabase.from("credit_transactions").insert({
          user_id: userId, type: "earn", activity: "first_listing",
          amount: 50, balance_after: newBalance, note: "🎉 First listing bonus",
        });
      }
    }
  } catch (e) {
    // SC award non-critical, don't fail listing creation
  }

  return NextResponse.json({ success: true, data });
}

// ── GET: Fetch listings ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category   = searchParams.get("category");
  const q          = searchParams.get("q");
  const seller_id  = searchParams.get("seller_id");
  const page       = parseInt(searchParams.get("page") ?? "1");
  const limit      = 20;

  let query = supabase
    .from("market_listings")
    .select("id, seller_id, seller_name, title, description, price_pi, category, subcategory, condition, buying_method, location, stock, type, images, cover_image, country_code, ship_worldwide, status, view_count, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (category && category !== "all") query = query.eq("category", category);
  if (q)         query = query.ilike("title", `%${q}%`);
  if (seller_id) query = query.eq("seller_id", seller_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, data: data ?? [] });
}
