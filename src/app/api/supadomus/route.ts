// src/app/api/supadomus/route.ts
// GET  — homepage data: featured listings, new projects, agents, stats
// POST — create listing, register agent, save/unsave, send inquiry

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { getCountry } from "@/lib/market/countries";

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

async function enrichListings(listings: any[]) {
  if (!listings?.length) return [];
  const sellerIds = [...new Set(listings.map((l: any) => l.seller_id))];
  const agentIds  = [...new Set(listings.map((l: any) => l.agent_id).filter(Boolean))];

  const [{ data: sellers }, { data: agents }] = await Promise.all([
    supabase.from("users").select("id, username, display_name, avatar_url, kyc_status").in("id", sellerIds),
    agentIds.length > 0
      ? supabase.from("domus_agents").select("id, agency_name, tier, verified, rating, photo_url").in("id", agentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const sellersMap: Record<string, any> = {};
  const agentsMap:  Record<string, any> = {};
  (sellers ?? []).forEach((s: any) => { sellersMap[s.id] = s; });
  (agents  ?? []).forEach((a: any) => { agentsMap[a.id]  = a; });

  return listings.map((l: any) => ({
    ...l,
    seller: sellersMap[l.seller_id],
    agent:  l.agent_id ? agentsMap[l.agent_id] : null,
    psf:    l.built_up_sqft && l.price_pi ? (l.price_pi / l.built_up_sqft).toFixed(2) : null,
  }));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode         = searchParams.get("mode") ?? "home";
  const listingMode  = searchParams.get("listing_mode") ?? "sale";
  const propertyType = searchParams.get("property_type") ?? "all";
  const bedrooms     = searchParams.get("bedrooms") ?? "";
  const furnishing   = searchParams.get("furnishing") ?? "";
  const tenure       = searchParams.get("tenure") ?? "";
  const minPrice     = searchParams.get("min_price") ?? "";
  const maxPrice     = searchParams.get("max_price") ?? "";
  const q            = searchParams.get("q") ?? "";
  const country      = searchParams.get("country") ?? "";
  const sort         = searchParams.get("sort") ?? "newest";
  const page         = parseInt(searchParams.get("page") ?? "1");
  const limit        = 20;
  const offset       = (page - 1) * limit;

  try {
    const countryFilter = country && country.toUpperCase() !== "WORLDWIDE";
    const countryPat = countryFilter ? `%${getCountry(country).name}%` : null;

    if (mode === "home") {
      let forSaleQ = supabase.from("domus_listings")
        .select("id, seller_id, agent_id, listing_mode, property_type, title, images, price_pi, bedrooms, bathrooms, built_up_sqft, furnishing, tenure, location, view_count, save_count, created_at")
        .eq("status", "active").eq("listing_mode", "sale")
        .order("view_count", { ascending: false }).limit(12);
      let forRentQ = supabase.from("domus_listings")
        .select("id, seller_id, agent_id, listing_mode, property_type, title, images, rental_pi_month, bedrooms, bathrooms, built_up_sqft, furnishing, location, view_count, save_count, created_at")
        .eq("status", "active").eq("listing_mode", "rent")
        .order("created_at", { ascending: false }).limit(8);
      if (countryPat) {
        forSaleQ = forSaleQ.ilike("location", countryPat);
        forRentQ = forRentQ.ilike("location", countryPat);
      }
      const [
        { data: forSale },
        { data: forRent },
        { data: projects },
        { data: topAgents },
        { count: saleCount },
        { count: rentCount },
      ] = await Promise.all([
        forSaleQ,
        forRentQ,
        supabase.from("domus_projects")
          .select("id, project_name, developer_name, images, location, property_type, min_price_pi, max_price_pi, total_units, available_units, expected_completion, tenure")
          .eq("status", "active").order("created_at", { ascending: false }).limit(6),
        supabase.from("domus_agents")
          .select("id, user_id, agency_name, tier, verified, rating, review_count, photo_url, specializations, total_listings, deals_closed")
          .eq("is_active", true).order("rating", { ascending: false }).limit(6),
        supabase.from("domus_listings").select("id", { count: "exact", head: true }).eq("status", "active").eq("listing_mode", "sale"),
        supabase.from("domus_listings").select("id", { count: "exact", head: true }).eq("status", "active").eq("listing_mode", "rent"),
      ]);

      const enrichedSale = await enrichListings(forSale ?? []);
      const enrichedRent = await enrichListings(forRent ?? []);

      // Enrich agents with user info
      const agentUserIds = (topAgents ?? []).map((a: any) => a.user_id);
      let agentUsersMap: Record<string, any> = {};
      if (agentUserIds.length > 0) {
        const { data: users } = await supabase.from("users").select("id, username, avatar_url, kyc_status").in("id", agentUserIds);
        (users ?? []).forEach((u: any) => { agentUsersMap[u.id] = u; });
      }

      return NextResponse.json({
        success: true,
        data: {
          stats: { sale: saleCount ?? 0, rent: rentCount ?? 0 },
          forSale: enrichedSale,
          forRent: enrichedRent,
          projects: projects ?? [],
          topAgents: (topAgents ?? []).map((a: any) => ({ ...a, user: agentUsersMap[a.user_id] })),
        }
      });
    }

    // Browse mode
    let query = supabase.from("domus_listings")
      .select("id, seller_id, agent_id, listing_mode, property_type, title, images, price_pi, rental_pi_month, negotiable, bedrooms, bathrooms, car_parks, built_up_sqft, furnishing, tenure, location, view_count, save_count, status, created_at")
      .eq("status", "active")
      .range(offset, offset + limit - 1);

    if (listingMode !== "all") query = query.eq("listing_mode", listingMode);
    if (propertyType !== "all") query = query.eq("property_type", propertyType);
    if (bedrooms)   query = query.gte("bedrooms", parseInt(bedrooms));
    if (furnishing) query = query.eq("furnishing", furnishing);
    if (tenure)     query = query.eq("tenure", tenure);
    if (q)          query = query.or(`title.ilike.%${q}%,location.ilike.%${q}%,description.ilike.%${q}%`);
    if (countryPat) query = query.ilike("location", countryPat);
    if (minPrice) {
      const col = listingMode === "rent" ? "rental_pi_month" : "price_pi";
      query = query.gte(col, parseFloat(minPrice));
    }
    if (maxPrice) {
      const col = listingMode === "rent" ? "rental_pi_month" : "price_pi";
      query = query.lte(col, parseFloat(maxPrice));
    }

    if (sort === "newest")      query = query.order("created_at", { ascending: false });
    else if (sort === "popular") query = query.order("view_count", { ascending: false });
    else if (sort === "price_asc")  {
      const col = listingMode === "rent" ? "rental_pi_month" : "price_pi";
      query = query.order(col, { ascending: true });
    }
    else if (sort === "price_desc") {
      const col = listingMode === "rent" ? "rental_pi_month" : "price_pi";
      query = query.order(col, { ascending: false });
    }

    const { data: listings } = await query;
    const enriched = await enrichListings(listings ?? []);
    return NextResponse.json({ success: true, data: { listings: enriched } });

  } catch (err: any) {
    console.error("[domus GET]", err);
    return NextResponse.json({ success: true, data: { forSale: [], forRent: [], projects: [], topAgents: [], stats: {} } });
  }
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  if (action === "create_listing") {
    const {
      listing_mode, property_type, title, description, images,
      virtual_tour_url, price_pi, rental_pi_month, negotiable,
      bedrooms, bathrooms, car_parks, built_up_sqft, land_sqft,
      furnishing, tenure, title_type, floor_level, facing,
      maintenance_fee_pi, location, lat, lng, amenities, nearby, specs,
    } = body;

    if (!title?.trim()) return NextResponse.json({ success: false, error: "Title required" }, { status: 400 });

    const { data: agent } = await supabase.from("domus_agents").select("id").eq("user_id", userId).maybeSingle();

    const { data, error } = await supabase.from("domus_listings").insert({
      seller_id: userId,
      agent_id: agent?.id ?? null,
      listing_mode: listing_mode ?? "sale",
      property_type: property_type ?? "apartment",
      title, description: description ?? "",
      images: images ?? [],
      virtual_tour_url: virtual_tour_url ?? "",
      price_pi: price_pi ? parseFloat(price_pi) : null,
      rental_pi_month: rental_pi_month ? parseFloat(rental_pi_month) : null,
      negotiable: negotiable ?? true,
      bedrooms: bedrooms ?? 0, bathrooms: bathrooms ?? 0,
      car_parks: car_parks ?? 0,
      built_up_sqft: built_up_sqft ?? null, land_sqft: land_sqft ?? null,
      furnishing: furnishing ?? "unfurnished",
      tenure: tenure ?? "freehold", title_type: title_type ?? "strata",
      floor_level: floor_level ?? null, facing: facing ?? "",
      maintenance_fee_pi: maintenance_fee_pi ?? 0,
      location: location ?? "", lat: lat ?? null, lng: lng ?? null,
      amenities: amenities ?? [], nearby: nearby ?? [], specs: specs ?? {},
    }).select().single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    // Update agent listing count
    if (agent?.id) {
      const { data: ag } = await supabase.from("domus_agents").select("total_listings").eq("id", agent.id).single();
      if (ag) await supabase.from("domus_agents").update({ total_listings: ag.total_listings + 1 }).eq("id", agent.id);
    }

    // SC reward first listing
    try {
      const { count } = await supabase.from("domus_listings").select("id", { count: "exact", head: true }).eq("seller_id", userId);
      if (count === 1) {
        await supabase.from("supapi_credits").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
        const { data: wallet } = await supabase.from("supapi_credits").select("balance, total_earned").eq("user_id", userId).single();
        if (wallet) {
          await supabase.from("supapi_credits").update({ balance: wallet.balance + 150, total_earned: wallet.total_earned + 150 }).eq("user_id", userId);
          await supabase.from("credit_transactions").insert({ user_id: userId, type: "earn", activity: "domus_first_listing", amount: 150, balance_after: wallet.balance + 150, note: "🏠 First Domus property listed!" });
        }
      }
    } catch {}

    return NextResponse.json({ success: true, data });
  }

  if (action === "register_agent") {
    const { license_no, agency_name, bio, specializations, languages, whatsapp } = body;
    const { data: existing } = await supabase.from("domus_agents").select("id").eq("user_id", userId).maybeSingle();
    if (existing) return NextResponse.json({ success: false, error: "Already registered as agent" }, { status: 400 });

    const { data, error } = await supabase.from("domus_agents").insert({
      user_id: userId, license_no: license_no ?? "", agency_name: agency_name ?? "",
      bio: bio ?? "", specializations: specializations ?? [],
      languages: languages ?? ["English"], whatsapp: whatsapp ?? "",
    }).select().single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    // SC reward agent registration
    try {
      await supabase.from("supapi_credits").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
      const { data: wallet } = await supabase.from("supapi_credits").select("balance, total_earned").eq("user_id", userId).single();
      if (wallet) {
        await supabase.from("supapi_credits").update({ balance: wallet.balance + 200, total_earned: wallet.total_earned + 200 }).eq("user_id", userId);
        await supabase.from("credit_transactions").insert({ user_id: userId, type: "earn", activity: "domus_agent_register", amount: 200, balance_after: wallet.balance + 200, note: "🏠 Domus Pioneer Agent registered!" });
      }
    } catch {}

    return NextResponse.json({ success: true, data });
  }

  if (action === "toggle_save") {
    const { listing_id } = body;
    const { data: existing } = await supabase.from("domus_saved").select("id").eq("user_id", userId).eq("listing_id", listing_id).maybeSingle();
    if (existing) {
      await supabase.from("domus_saved").delete().eq("user_id", userId).eq("listing_id", listing_id);
      const { data: l } = await supabase.from("domus_listings").select("save_count").eq("id", listing_id).single();
      if (l) await supabase.from("domus_listings").update({ save_count: Math.max(0, l.save_count - 1) }).eq("id", listing_id);
      return NextResponse.json({ success: true, saved: false });
    } else {
      await supabase.from("domus_saved").insert({ user_id: userId, listing_id });
      const { data: l } = await supabase.from("domus_listings").select("save_count").eq("id", listing_id).single();
      if (l) await supabase.from("domus_listings").update({ save_count: l.save_count + 1 }).eq("id", listing_id);
      return NextResponse.json({ success: true, saved: true });
    }
  }

  if (action === "send_inquiry") {
    const { listing_id, seller_id, agent_id, message, inquiry_type, proposed_price_pi } = body;

    const { data, error } = await supabase.from("domus_inquiries").insert({
      listing_id, seller_id, buyer_id: userId,
      agent_id: agent_id ?? null,
      message, inquiry_type: inquiry_type ?? "viewing",
      proposed_price_pi: proposed_price_pi ?? null,
    }).select().single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const { data: l } = await supabase.from("domus_listings").select("inquiry_count").eq("id", listing_id).single();
    if (l) await supabase.from("domus_listings").update({ inquiry_count: l.inquiry_count + 1 }).eq("id", listing_id);

    // SC reward first inquiry
    try {
      const { count } = await supabase.from("domus_inquiries").select("id", { count: "exact", head: true }).eq("buyer_id", userId);
      if (count === 1) {
        await supabase.from("supapi_credits").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
        const { data: wallet } = await supabase.from("supapi_credits").select("balance, total_earned").eq("user_id", userId).single();
        if (wallet) {
          await supabase.from("supapi_credits").update({ balance: wallet.balance + 20, total_earned: wallet.total_earned + 20 }).eq("user_id", userId);
          await supabase.from("credit_transactions").insert({ user_id: userId, type: "earn", activity: "domus_first_inquiry", amount: 20, balance_after: wallet.balance + 20, note: "🏠 First Domus inquiry sent!" });
        }
      }
    } catch {}

    return NextResponse.json({ success: true, data });
  }

  return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
}
