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
  a: { created_at?: string | null; views?: number | null },
  b: { created_at?: string | null; views?: number | null },
  sort: string
): number {
  if (sort === "popular") return Number(b.views ?? 0) - Number(a.views ?? 0);
  return ts(b.created_at) - ts(a.created_at);
}

function sortByBoostPriority<T extends { is_boosted?: boolean | null; boost_tier?: string | null; boost_expires_at?: string | null; created_at?: string | null; views?: number | null }>(
  rows: T[],
  sort: string
): T[] {
  return [...rows].sort((a, b) => {
    const boostDiff = boostScore(b) - boostScore(a);
    if (boostDiff !== 0) return boostDiff;
    return baseSortDiff(a, b, sort);
  });
}

function getUserId(req: NextRequest): string | null {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId?: string; id?: string; sub?: string };
    return String(decoded.userId ?? decoded.id ?? decoded.sub ?? "");
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? "";
  const subcategory = searchParams.get("subcategory") ?? "";
  const categoryDeep = searchParams.get("category_deep") ?? "";
  const q = (searchParams.get("q") ?? "").trim();
  const countryRaw = searchParams.get("country") ?? "";
  const country = countryRaw.toUpperCase();
  const sellerUser = searchParams.get("seller") ?? "";
  const sort = searchParams.get("sort") ?? "newest";
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    try {
      await supabase.rpc("expire_classified_boosts");
      await supabase.rpc("expire_classified_promotions");
      await supabase.rpc("run_classified_autorepost");
    } catch {
      /* optional RPC */
    }

    let query = supabase
      .from("classified_listings")
      .select(
        `id, title, description, price_display, category, subcategory, category_deep, images, status, location, country_code, views, created_at, is_boosted, boost_tier, boost_expires_at, seller:seller_id ( id, username, display_name, avatar_url, kyc_status )`,
        { count: "exact" }
      )
      .eq("status", "active");

    if (category) query = query.eq("category", category);
    if (subcategory) query = query.eq("subcategory", subcategory);
    if (categoryDeep) query = query.eq("category_deep", categoryDeep);
    if (country && country !== "WORLDWIDE") {
      query = query.eq("country_code", country);
    }
    if (q) {
      const terms = q
        .toLowerCase()
        .replace(/[,]+/g, " ")
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 5);

      for (const term of terms) {
        const safe = term.replace(/[%_]/g, "");
        query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%,location.ilike.%${safe}%`);
      }
    }
    if (sellerUser.trim()) {
      const { data: u } = await supabase.from("users").select("id").eq("username", sellerUser.trim()).single();
      if (u) query = query.eq("seller_id", u.id);
    }

    if (sort === "popular") {
      query = query.order("is_boosted", { ascending: false }).order("views", { ascending: false });
    } else {
      query = query.order("is_boosted", { ascending: false }).order("created_at", { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    let listings = sortByBoostPriority(data ?? [], sort);
    if (category && listings.length > 1) {
      const { data: spotlightRows } = await supabase
        .from("classified_spotlights")
        .select("listing_id")
        .eq("category", category)
        .eq("is_active", true)
        .gte("expires_at", new Date().toISOString());
      const spotlightIds = new Set((spotlightRows ?? []).map((r) => String(r.listing_id)));
      listings = [...listings].sort((a, b) => {
        const spotlightDiff = Number(spotlightIds.has(String(b.id))) - Number(spotlightIds.has(String(a.id)));
        if (spotlightDiff !== 0) return spotlightDiff;
        const boostDiff = boostScore(b as any) - boostScore(a as any);
        if (boostDiff !== 0) return boostDiff;
        return baseSortDiff(a, b, sort);
      });
    }

    const listingIds = listings.map((row) => String(row.id));
    const spotlightMap = new Map<string, string>();
    if (listingIds.length) {
      const { data: spotRows } = await supabase
        .from("classified_spotlights")
        .select("listing_id, expires_at")
        .in("listing_id", listingIds)
        .eq("is_active", true)
        .gte("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false });
      for (const row of spotRows ?? []) {
        const id = String(row.listing_id ?? "");
        if (id && !spotlightMap.has(id)) spotlightMap.set(id, String(row.expires_at ?? ""));
      }
    }
    listings = listings.map((row) => ({
      ...row,
      spotlight_expires_at: spotlightMap.get(String(row.id)) ?? null,
    }));

    return NextResponse.json({
      success: true,
      data: { listings, total: count ?? 0, page, limit },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, "classified_listing_create", 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    title,
    description,
    category,
    subcategory,
    category_deep,
    price_display,
    images,
    location,
    country_code,
    contact_phone,
    contact_whatsapp,
  } = body;

  if (!title?.trim() || !category) {
    return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("classified_listings")
      .insert({
        seller_id: userId,
        title: title.trim(),
        description: description ?? "",
        category,
        subcategory: subcategory ?? "",
        category_deep: typeof category_deep === "string" ? category_deep : "",
        price_display: price_display?.trim() ? String(price_display).trim() : null,
        images: images ?? [],
        location: location ?? "",
        country_code: country_code ?? null,
        contact_phone: contact_phone?.trim() ? String(contact_phone).trim() : null,
        contact_whatsapp: contact_whatsapp?.trim() ? String(contact_whatsapp).trim() : null,
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
