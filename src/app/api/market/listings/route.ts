// src/app/api/market/listings/route.ts
// GET  — browse listings (boosted first)
// POST — create listing + SC reward

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { checkRateLimit } from "@/lib/security/rate-limit";

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

async function awardSC(userId: string, event: string, refId: string, amount: number, note: string) {
  try {
    const { count } = await supabase.from("market_sc_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("event", event).eq("ref_id", refId);
    if ((count ?? 0) > 0) return;

    await supabase.from("supapi_credits").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
    const { data: w } = await supabase.from("supapi_credits").select("balance, total_earned").eq("user_id", userId).single();
    if (!w) return;

    await supabase.from("supapi_credits").update({ balance: w.balance + amount, total_earned: w.total_earned + amount }).eq("user_id", userId);
    await supabase.from("credit_transactions").insert({ user_id: userId, type: "earn", activity: event, amount, balance_after: w.balance + amount, note });
    await supabase.from("market_sc_events").insert({ user_id: userId, event, ref_id: refId, sc_amount: amount });
  } catch {}
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category    = searchParams.get("category")    ?? "";
  const subcategory = searchParams.get("subcategory") ?? "";
  const q           = searchParams.get("q")           ?? "";
  const method      = searchParams.get("method")      ?? "";
  const condition   = searchParams.get("condition")   ?? "";
  const sort        = searchParams.get("sort")        ?? "newest";
  const countryRaw  = searchParams.get("country")     ?? "";
  const country     = countryRaw.toUpperCase();
  const page        = parseInt(searchParams.get("page") ?? "1");
  const limit       = 20;
  const offset      = (page - 1) * limit;

  try {
    try { await supabase.rpc("expire_listing_boosts"); } catch {}

    let query = supabase.from("listings")
      .select(`id, title, description, price_pi, category, subcategory, condition, buying_method, images, stock, status, location, views, likes, created_at, is_boosted, boost_tier, seller:seller_id ( id, username, display_name, avatar_url, kyc_status )`, { count: "exact" })
      .eq("status", "active").gt("stock", 0);

    if (category)    query = query.eq("category", category);
    if (subcategory) query = query.eq("subcategory", subcategory);
    if (condition)   query = query.eq("condition", condition);
    if (country === "WORLDWIDE") {
      query = query.eq("ship_worldwide", true);
    } else if (country) {
      query = query.or(`country_code.eq.${country},ship_worldwide.eq.true`);
    }
    if (method)      query = query.or(`buying_method.eq.${method},buying_method.eq.both`);
    if (q)           query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);

    if (sort === "price_asc")       query = query.order("is_boosted", { ascending: false }).order("price_pi",   { ascending: true  });
    else if (sort === "price_desc") query = query.order("is_boosted", { ascending: false }).order("price_pi",   { ascending: false });
    else if (sort === "popular")    query = query.order("is_boosted", { ascending: false }).order("views",      { ascending: false });
    else                            query = query.order("is_boosted", { ascending: false }).order("created_at", { ascending: false });

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, data: { listings: data ?? [], total: count ?? 0, page, limit } });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, "market_listing_create", 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, description, price_pi, category, subcategory, condition, buying_method, images, stock, location, type } = body;

  if (!title?.trim() || !price_pi || !category)
    return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });

  try {
    const { data, error } = await supabase.from("listings").insert({
      seller_id: userId, title: title.trim(), description: description ?? "",
      price_pi: parseFloat(price_pi), category, subcategory: subcategory ?? "",
      condition: condition ?? "new", buying_method: buying_method ?? "both",
      images: images ?? [], stock: stock ?? 1, location: location ?? "",
      type: type ?? "physical", status: "active",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).select().single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const { count } = await supabase.from("listings").select("id", { count: "exact", head: true })
      .eq("seller_id", userId).neq("status", "removed");

    if ((count ?? 0) === 1) {
      await awardSC(userId, "marketplace_first_listing", data.id, 50, "🛍️ First marketplace listing!");
    } else {
      await awardSC(userId, "new_listing", data.id, 20, "🛍️ New listing created!");
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
