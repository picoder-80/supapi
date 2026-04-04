// src/app/api/supamarket/listings/route.ts
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

const BOOST_TIER_WEIGHT: Record<string, number> = {
  gold: 3,
  silver: 2,
  bronze: 1,
};

function ts(input: unknown): number {
  if (!input) return 0;
  const n = new Date(String(input)).getTime();
  return Number.isFinite(n) ? n : 0;
}

function boostScore(row: { is_boosted?: boolean | null; boost_tier?: string | null; boost_expires_at?: string | null }): number {
  if (!row?.is_boosted) return 0;
  const exp = ts(row.boost_expires_at);
  if (exp <= Date.now()) return 0;
  const tierWeight = BOOST_TIER_WEIGHT[String(row.boost_tier ?? "").toLowerCase()] ?? 0;
  return tierWeight * 10_000_000_000 + exp;
}

function baseSortDiff(
  a: { price_pi?: number | null; views?: number | null; created_at?: string | null },
  b: { price_pi?: number | null; views?: number | null; created_at?: string | null },
  sort: string
): number {
  if (sort === "price_asc") return Number(a.price_pi ?? 0) - Number(b.price_pi ?? 0);
  if (sort === "price_desc") return Number(b.price_pi ?? 0) - Number(a.price_pi ?? 0);
  if (sort === "popular") return Number(b.views ?? 0) - Number(a.views ?? 0);
  return ts(b.created_at) - ts(a.created_at);
}

function sortByBoostPriority<T extends { is_boosted?: boolean | null; boost_tier?: string | null; boost_expires_at?: string | null; price_pi?: number | null; views?: number | null; created_at?: string | null }>(
  rows: T[],
  sort: string
): T[] {
  return [...rows].sort((a, b) => {
    const boostDiff = boostScore(b) - boostScore(a);
    if (boostDiff !== 0) return boostDiff;
    return baseSortDiff(a, b, sort);
  });
}

function applyActiveBoostFallback<T extends { id?: string; is_boosted?: boolean | null; boost_tier?: string | null; boost_expires_at?: string | null }>(
  rows: T[],
  boostMap: Map<string, { tier: string | null; expires_at: string | null }>
): T[] {
  return rows.map((row) => {
    const id = String(row.id ?? "");
    if (!id) return row;
    const active = boostMap.get(id);
    if (!active) return row;
    return {
      ...row,
      is_boosted: true,
      boost_tier: active.tier ?? row.boost_tier ?? null,
      boost_expires_at: active.expires_at ?? row.boost_expires_at ?? null,
    };
  });
}

function applyActiveSpotlightFallback<T extends { id?: string; spotlight_expires_at?: string | null }>(
  rows: T[],
  spotlightMap: Map<string, string>
): T[] {
  return rows.map((row) => {
    const id = String(row.id ?? "");
    if (!id) return row;
    const expiresAt = spotlightMap.get(id);
    if (!expiresAt) return row;
    return {
      ...row,
      spotlight_expires_at: expiresAt,
    };
  });
}

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
  const category     = searchParams.get("category")      ?? "";
  const subcategory  = searchParams.get("subcategory")   ?? "";
  const categoryDeep = searchParams.get("category_deep") ?? "";
  const q           = searchParams.get("q")           ?? "";
  const method      = searchParams.get("method")      ?? "";
  const condition   = searchParams.get("condition")   ?? "";
  const sort        = searchParams.get("sort")        ?? "newest";
  const countryRaw  = searchParams.get("country")     ?? "";
  const country     = countryRaw.toUpperCase();
  const sellerUser  = searchParams.get("seller")       ?? "";
  const page        = parseInt(searchParams.get("page") ?? "1");
  const limit       = 20;
  const offset      = (page - 1) * limit;

  try {
    try { await supabase.rpc("expire_listing_boosts"); } catch {}

    let query = supabase.from("listings")
      .select(`id, title, description, price_pi, category, subcategory, category_deep, condition, buying_method, images, stock, status, location, country_code, ship_worldwide, views, likes, created_at, is_boosted, boost_tier, boost_expires_at, seller:seller_id ( id, username, display_name, avatar_url, kyc_status )`, { count: "exact" })
      .eq("status", "active")
      // Backward compatibility: older rows may have NULL stock; treat as available.
      .or("stock.gt.0,stock.is.null");

    if (category)      query = query.eq("category", category);
    if (subcategory)  query = query.eq("subcategory", subcategory);
    if (categoryDeep) query = query.eq("category_deep", categoryDeep);
    if (condition)   query = query.eq("condition", condition);
    if (country === "WORLDWIDE") {
      query = query.eq("ship_worldwide", true);
    } else if (country) {
      // Backward compatibility: older rows may have NULL country_code.
      query = query.or(`country_code.eq.${country},ship_worldwide.eq.true,country_code.is.null`);
    }
    if (method)      query = query.or(`buying_method.eq.${method},buying_method.eq.both`);
    if (q)           query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    if (sellerUser?.trim()) {
      const { data: u } = await supabase.from("users").select("id").eq("username", sellerUser.trim()).single();
      if (u) query = query.eq("seller_id", u.id);
    }

    if (sort === "price_asc")       query = query.order("is_boosted", { ascending: false }).order("price_pi",   { ascending: true  });
    else if (sort === "price_desc") query = query.order("is_boosted", { ascending: false }).order("price_pi",   { ascending: false });
    else if (sort === "popular")    query = query.order("is_boosted", { ascending: false }).order("views",      { ascending: false });
    else                            query = query.order("is_boosted", { ascending: false }).order("created_at", { ascending: false });

    query = query.range(offset, offset + limit - 1);

    let { data, count, error } = await query;
    if (error) {
      const msg = String(error.message ?? "");
      const missingColumn =
        msg.includes("does not exist") ||
        msg.includes("column") ||
        msg.includes("schema cache");
      if (!missingColumn) {
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
      }

      // Legacy schema fallback (without newer columns like category_deep/is_boosted/country_code).
      let compatQuery = supabase
        .from("listings")
        .select(
          `id, title, description, price_pi, category, subcategory, condition, buying_method, images, stock, status, location, views, likes, created_at, is_boosted, boost_tier, boost_expires_at, seller:seller_id ( id, username, display_name, avatar_url, kyc_status )`,
          { count: "exact" }
        )
        .eq("status", "active")
        .or("stock.gt.0,stock.is.null");

      if (category) compatQuery = compatQuery.eq("category", category);
      if (subcategory) compatQuery = compatQuery.eq("subcategory", subcategory);
      if (condition) compatQuery = compatQuery.eq("condition", condition);
      if (method) compatQuery = compatQuery.or(`buying_method.eq.${method},buying_method.eq.both`);
      if (q) compatQuery = compatQuery.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
      if (sellerUser?.trim()) {
        const { data: u } = await supabase.from("users").select("id").eq("username", sellerUser.trim()).single();
        if (u) compatQuery = compatQuery.eq("seller_id", u.id);
      }

      if (sort === "price_asc") compatQuery = compatQuery.order("price_pi", { ascending: true });
      else if (sort === "price_desc") compatQuery = compatQuery.order("price_pi", { ascending: false });
      else if (sort === "popular") compatQuery = compatQuery.order("views", { ascending: false });
      else compatQuery = compatQuery.order("created_at", { ascending: false });

      const compatRes = await compatQuery.range(offset, offset + limit - 1);
      if (!compatRes.error) {
        data = (compatRes.data ?? []).map((row: any) => ({
          ...row,
          category_deep: "",
          country_code: null,
          ship_worldwide: false,
        }));
        count = compatRes.count ?? 0;
      } else {
        let legacyQuery = supabase
        .from("listings")
        .select(
          `id, title, description, price_pi, category, subcategory, condition, buying_method, images, stock, status, location, views, likes, created_at, seller:seller_id ( id, username, display_name, avatar_url, kyc_status )`,
          { count: "exact" }
        )
        .eq("status", "active")
        .or("stock.gt.0,stock.is.null");

        if (category) legacyQuery = legacyQuery.eq("category", category);
        if (subcategory) legacyQuery = legacyQuery.eq("subcategory", subcategory);
        if (condition) legacyQuery = legacyQuery.eq("condition", condition);
        if (method) legacyQuery = legacyQuery.or(`buying_method.eq.${method},buying_method.eq.both`);
        if (q) legacyQuery = legacyQuery.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
        if (sellerUser?.trim()) {
          const { data: u } = await supabase.from("users").select("id").eq("username", sellerUser.trim()).single();
          if (u) legacyQuery = legacyQuery.eq("seller_id", u.id);
        }

        if (sort === "price_asc") legacyQuery = legacyQuery.order("price_pi", { ascending: true });
        else if (sort === "price_desc") legacyQuery = legacyQuery.order("price_pi", { ascending: false });
        else if (sort === "popular") legacyQuery = legacyQuery.order("views", { ascending: false });
        else legacyQuery = legacyQuery.order("created_at", { ascending: false });

        const legacyRes = await legacyQuery.range(offset, offset + limit - 1);
        if (legacyRes.error) {
          return NextResponse.json({ success: false, error: legacyRes.error.message }, { status: 500 });
        }

        data = (legacyRes.data ?? []).map((row: any) => ({
          ...row,
          category_deep: "",
          country_code: null,
          ship_worldwide: false,
          is_boosted: false,
          boost_tier: null,
          boost_expires_at: null,
        }));
        count = legacyRes.count ?? 0;
      }
    }

    // Safety fallback for legacy rows:
    // if default browse returns empty, retry with relaxed stock/country constraints.
    const isDefaultBrowse =
      !category && !subcategory && !categoryDeep && !q && !method && !condition && !sellerUser?.trim();
    if ((count ?? 0) === 0 && isDefaultBrowse && page === 1) {
      const relaxed = await supabase
        .from("listings")
        .select(
          `id, title, description, price_pi, category, subcategory, category_deep, condition, buying_method, images, stock, status, location, country_code, ship_worldwide, views, likes, created_at, is_boosted, boost_tier, boost_expires_at, seller:seller_id ( id, username, display_name, avatar_url, kyc_status )`,
          { count: "exact" }
        )
        .eq("status", "active")
        .order("is_boosted", { ascending: false })
        .order("created_at", { ascending: false })
        .range(0, limit - 1);
      if (!relaxed.error && (relaxed.count ?? 0) > 0) {
        data = relaxed.data;
        count = relaxed.count;
      }
    }

    let rows = data ?? [];
    try {
      const listingIds = rows.map((r: any) => String(r.id ?? "")).filter(Boolean);
      if (listingIds.length) {
        const { data: activeBoosts } = await supabase
          .from("listing_boosts")
          .select("listing_id, tier, expires_at, boosted_at")
          .in("listing_id", listingIds)
          .gt("expires_at", new Date().toISOString())
          .order("boosted_at", { ascending: false });

        if (activeBoosts?.length) {
          const boostMap = new Map<string, { tier: string | null; expires_at: string | null }>();
          for (const b of activeBoosts) {
            const key = String((b as any).listing_id ?? "");
            if (!key || boostMap.has(key)) continue;
            boostMap.set(key, {
              tier: (b as any).tier ?? null,
              expires_at: (b as any).expires_at ?? null,
            });
          }
          rows = applyActiveBoostFallback(rows as any[], boostMap) as typeof rows;
        }

        const { data: activeSpotlights } = await supabase
          .from("market_spotlights")
          .select("listing_id, expires_at, starts_at")
          .in("listing_id", listingIds)
          .eq("is_active", true)
          .gt("expires_at", new Date().toISOString())
          .order("starts_at", { ascending: false });

        if (activeSpotlights?.length) {
          const spotlightMap = new Map<string, string>();
          for (const s of activeSpotlights) {
            const key = String((s as any).listing_id ?? "");
            const expiresAt = String((s as any).expires_at ?? "");
            if (!key || !expiresAt || spotlightMap.has(key)) continue;
            spotlightMap.set(key, expiresAt);
          }
          rows = applyActiveSpotlightFallback(rows as any[], spotlightMap) as typeof rows;
        }
      }
    } catch {
      // Best-effort fallback; ignore when listing_boosts table is unavailable.
    }

    const listings = sortByBoostPriority(rows, sort);

    return NextResponse.json({ success: true, data: { listings, total: count ?? 0, page, limit } });
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
  const { title, description, price_pi, category, subcategory, category_deep, condition, buying_method, images, stock, location, type, country_code, ship_worldwide } = body;

  if (!title?.trim() || !price_pi || !category)
    return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });

  try {
    const insertPayload: Record<string, unknown> = {
      seller_id: userId, title: title.trim(), description: description ?? "",
      price_pi: parseFloat(price_pi), category, subcategory: subcategory ?? "",
      category_deep: typeof category_deep === "string" ? category_deep : "",
      condition: condition ?? "new", buying_method: buying_method ?? "both",
      images: images ?? [], stock: stock ?? 1, location: location ?? "",
      type: type ?? "physical", status: "active",
      country_code: country_code ?? null, ship_worldwide: Boolean(ship_worldwide),
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };

    let { data, error } = await supabase.from("listings").insert(insertPayload).select().single();
    if (error) {
      const msg = String(error.message ?? "");
      const missingCategoryDeep =
        msg.includes("category_deep") &&
        (msg.includes("schema cache") || msg.includes("does not exist") || msg.includes("column"));
      if (!missingCategoryDeep) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      const fallbackPayload = { ...insertPayload };
      delete fallbackPayload.category_deep;
      const retry = await supabase.from("listings").insert(fallbackPayload).select().single();
      data = retry.data;
      error = retry.error;
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const { count } = await supabase.from("listings").select("id", { count: "exact", head: true })
      .eq("seller_id", userId).neq("status", "deleted");

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
