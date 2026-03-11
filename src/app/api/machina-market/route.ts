// src/app/api/machina-market/route.ts
// GET  — homepage: featured listings, stats, workshops
// POST — create listing, save/unsave, inquiry

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

async function enrichWithSellers(listings: any[]) {
  if (!listings?.length) return [];
  const sellerIds = [...new Set(listings.map((l: any) => l.seller_id))];
  const { data: sellers } = await supabase
    .from("users").select("id, username, display_name, avatar_url, kyc_status").in("id", sellerIds);
  const sellersMap: Record<string, any> = {};
  (sellers ?? []).forEach((s: any) => { sellersMap[s.id] = s; });
  return listings.map((l: any) => ({ ...l, seller: sellersMap[l.seller_id] }));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vehicleType = searchParams.get("vehicle_type") ?? "all";
  const listingType = searchParams.get("listing_type") ?? "vehicle";
  const make        = searchParams.get("make") ?? "";
  const q           = searchParams.get("q") ?? "";
  const sort        = searchParams.get("sort") ?? "newest";
  const minPrice    = searchParams.get("min_price");
  const maxPrice    = searchParams.get("max_price");
  const transmission = searchParams.get("transmission") ?? "";
  const fuelType    = searchParams.get("fuel_type") ?? "";
  const page        = parseInt(searchParams.get("page") ?? "1");
  const mode        = searchParams.get("mode") ?? "home";
  const limit       = 20;
  const offset      = (page - 1) * limit;

  try {
    if (mode === "home") {
      const [
        { data: featured },
        { data: recentParts },
        { data: workshops },
        { count: totalListings },
        { count: totalVehicles },
      ] = await Promise.all([
        supabase.from("machina_listings")
          .select("id, seller_id, listing_type, vehicle_type, make, model, year, mileage, color, transmission, fuel_type, condition, price_pi, negotiable, images, location, view_count, save_count, status, created_at")
          .eq("status", "active").eq("listing_type", "vehicle")
          .order("view_count", { ascending: false }).limit(12),
        supabase.from("machina_listings")
          .select("id, seller_id, listing_type, make, model, price_pi, images, condition, part_condition, location, created_at")
          .eq("status", "active").eq("listing_type", "parts")
          .order("created_at", { ascending: false }).limit(8),
        supabase.from("machina_workshops")
          .select("id, name, location, specializations, rating, review_count, verified, logo_url")
          .eq("is_active", true).order("rating", { ascending: false }).limit(6),
        supabase.from("machina_listings").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("machina_listings").select("id", { count: "exact", head: true }).eq("status", "active").eq("listing_type", "vehicle"),
      ]);

      const enrichedFeatured = await enrichWithSellers(featured ?? []);
      const enrichedParts    = await enrichWithSellers(recentParts ?? []);

      return NextResponse.json({
        success: true,
        data: {
          stats: { total: totalListings ?? 0, vehicles: totalVehicles ?? 0, workshops: 0 },
          featured: enrichedFeatured,
          recentParts: enrichedParts,
          workshops: workshops ?? [],
        }
      });
    }

    // Browse mode
    let query = supabase.from("machina_listings")
      .select("id, seller_id, listing_type, vehicle_type, make, model, year, mileage, color, transmission, fuel_type, condition, price_pi, negotiable, images, location, view_count, save_count, status, created_at, auction_end_at, part_condition")
      .eq("status", "active")
      .range(offset, offset + limit - 1);

    if (listingType !== "all") query = query.eq("listing_type", listingType);
    if (vehicleType !== "all") query = query.eq("vehicle_type", vehicleType);
    if (make)         query = query.ilike("make", `%${make}%`);
    if (q)            query = query.or(`make.ilike.%${q}%,model.ilike.%${q}%,description.ilike.%${q}%`);
    if (transmission) query = query.eq("transmission", transmission);
    if (fuelType)     query = query.eq("fuel_type", fuelType);
    if (minPrice)     query = query.gte("price_pi", parseFloat(minPrice));
    if (maxPrice)     query = query.lte("price_pi", parseFloat(maxPrice));

    if (sort === "newest")    query = query.order("created_at", { ascending: false });
    else if (sort === "price_asc")  query = query.order("price_pi", { ascending: true });
    else if (sort === "price_desc") query = query.order("price_pi", { ascending: false });
    else if (sort === "popular")    query = query.order("view_count", { ascending: false });

    const { data: listings } = await query;
    const enriched = await enrichWithSellers(listings ?? []);
    return NextResponse.json({ success: true, data: { listings: enriched } });

  } catch (err: any) {
    console.error("[machina GET]", err);
    return NextResponse.json({ success: true, data: { featured: [], recentParts: [], workshops: [], stats: {} } });
  }
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  if (action === "create_listing") {
    const { listing_type, vehicle_type, make, model, year, mileage, color, transmission,
      fuel_type, condition, price_pi, negotiable, images, description, location,
      specs, history_declared, auction_end_at, reserve_price_pi,
      part_condition, compatible_makes } = body;

    if (!price_pi || parseFloat(price_pi) < 0) return NextResponse.json({ success: false, error: "Price required" }, { status: 400 });

    const { data, error } = await supabase.from("machina_listings").insert({
      seller_id: userId,
      listing_type: listing_type ?? "vehicle",
      vehicle_type: vehicle_type ?? "car",
      make: make ?? "", model: model ?? "",
      year: year ?? null, mileage: mileage ?? null,
      color: color ?? "", transmission: transmission ?? "automatic",
      fuel_type: fuel_type ?? "petrol", condition: condition ?? "used",
      price_pi: parseFloat(price_pi), negotiable: negotiable ?? true,
      images: images ?? [], description: description ?? "",
      location: location ?? "", specs: specs ?? {},
      history_declared: history_declared ?? { accident: false, flood: false, modified: false, imported: false },
      auction_end_at: auction_end_at ?? null,
      reserve_price_pi: reserve_price_pi ?? null,
      part_condition: part_condition ?? "used",
      compatible_makes: compatible_makes ?? [],
    }).select().single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    // SC Reward — first listing
    try {
      const scReward = listing_type === "vehicle" ? 150 : listing_type === "parts" ? 50 : 100;
      const { count } = await supabase.from("machina_listings").select("id", { count: "exact", head: true }).eq("seller_id", userId).eq("listing_type", listing_type ?? "vehicle");
      if (count === 1) {
        await supabase.from("supapi_credits").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
        const { data: wallet } = await supabase.from("supapi_credits").select("balance, total_earned").eq("user_id", userId).single();
        if (wallet) {
          await supabase.from("supapi_credits").update({ balance: wallet.balance + scReward, total_earned: wallet.total_earned + scReward }).eq("user_id", userId);
          await supabase.from("credit_transactions").insert({ user_id: userId, type: "earn", activity: `machina_first_${listing_type ?? "vehicle"}`, amount: scReward, balance_after: wallet.balance + scReward, note: `🚗 First MachinaMarket ${listing_type} listed!` });
        }
      }
    } catch {}

    return NextResponse.json({ success: true, data });
  }

  if (action === "toggle_save") {
    const { listing_id } = body;
    const { data: existing } = await supabase.from("machina_saved").select("id").eq("user_id", userId).eq("listing_id", listing_id).maybeSingle();
    if (existing) {
      await supabase.from("machina_saved").delete().eq("user_id", userId).eq("listing_id", listing_id);
      const { data: l } = await supabase.from("machina_listings").select("save_count").eq("id", listing_id).single();
      if (l) await supabase.from("machina_listings").update({ save_count: Math.max(0, l.save_count - 1) }).eq("id", listing_id);
      return NextResponse.json({ success: true, saved: false });
    } else {
      await supabase.from("machina_saved").insert({ user_id: userId, listing_id });
      const { data: l } = await supabase.from("machina_listings").select("save_count").eq("id", listing_id).single();
      if (l) await supabase.from("machina_listings").update({ save_count: l.save_count + 1 }).eq("id", listing_id);
      return NextResponse.json({ success: true, saved: true });
    }
  }

  if (action === "send_inquiry") {
    const { listing_id, seller_id, message, offer_pi } = body;
    const { data, error } = await supabase.from("machina_inquiries").insert({
      listing_id, buyer_id: userId, seller_id, message, offer_pi: offer_pi ?? null,
    }).select().single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    const { data: l } = await supabase.from("machina_listings").select("inquiry_count").eq("id", listing_id).single();
    if (l) await supabase.from("machina_listings").update({ inquiry_count: l.inquiry_count + 1 }).eq("id", listing_id);
    return NextResponse.json({ success: true, data });
  }

  return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
}
