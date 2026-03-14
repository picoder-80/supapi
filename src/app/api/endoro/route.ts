// src/app/api/endoro/route.ts
// GET  — homepage data / browse vehicles
// POST — create vehicle listing, book, save/unsave

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

async function enrichVehicles(vehicles: any[]) {
  if (!vehicles?.length) return [];
  const hostIds = [...new Set(vehicles.map((v: any) => v.host_id))];
  const { data: hosts } = await supabase
    .from("users").select("id, username, display_name, avatar_url, kyc_status").in("id", hostIds);
  const hostsMap: Record<string, any> = {};
  (hosts ?? []).forEach((h: any) => { hostsMap[h.id] = h; });
  return vehicles.map((v: any) => ({ ...v, host: hostsMap[v.host_id] }));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode         = searchParams.get("mode") ?? "home";
  const vehicleType  = searchParams.get("vehicle_type") ?? "all";
  const startDate    = searchParams.get("start_date") ?? "";
  const endDate      = searchParams.get("end_date") ?? "";
  const q            = searchParams.get("q") ?? "";
  const country      = searchParams.get("country") ?? "";
  const sort         = searchParams.get("sort") ?? "popular";
  const instantBook  = searchParams.get("instant_book") ?? "";
  const transmission = searchParams.get("transmission") ?? "";
  const minPrice     = searchParams.get("min_price") ?? "";
  const maxPrice     = searchParams.get("max_price") ?? "";
  const page         = parseInt(searchParams.get("page") ?? "1");
  const limit        = 20;
  const offset       = (page - 1) * limit;

  try {
    const countryFilter = country && country.toUpperCase() !== "WORLDWIDE";
    const countryPat = countryFilter ? `%${getCountry(country).name}%` : null;

    if (mode === "home") {
      let featuredQ = supabase.from("endoro_vehicles")
        .select("id, host_id, vehicle_type, make, model, year, color, seats, transmission, fuel_type, images, location, instant_book, daily_rate_pi, deposit_pi, rating, review_count, booking_count, host_tier, status")
        .eq("status", "active")
        .order("booking_count", { ascending: false })
        .limit(12);
      let topRatedQ = supabase.from("endoro_vehicles")
        .select("id, host_id, vehicle_type, make, model, year, images, location, daily_rate_pi, rating, review_count, instant_book, host_tier")
        .eq("status", "active")
        .gte("review_count", 1)
        .order("rating", { ascending: false })
        .limit(8);
      if (countryPat) {
        featuredQ = featuredQ.ilike("location", countryPat);
        topRatedQ = topRatedQ.ilike("location", countryPat);
      }
      const [
        { data: featured },
        { data: topRated },
        { count: totalVehicles },
        { count: totalHosts },
      ] = await Promise.all([
        featuredQ,
        topRatedQ,
        supabase.from("endoro_vehicles").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("endoro_vehicles").select("host_id", { count: "exact", head: true }).eq("status", "active"),
      ]);

      const enrichedFeatured  = await enrichVehicles(featured ?? []);
      const enrichedTopRated  = await enrichVehicles(topRated ?? []);

      return NextResponse.json({
        success: true,
        data: {
          stats: { vehicles: totalVehicles ?? 0, hosts: totalHosts ?? 0 },
          featured: enrichedFeatured,
          topRated: enrichedTopRated,
        }
      });
    }

    // Browse mode
    let query = supabase.from("endoro_vehicles")
      .select("id, host_id, vehicle_type, make, model, year, color, seats, transmission, fuel_type, images, location, instant_book, delivery_available, daily_rate_pi, weekly_rate_pi, deposit_pi, rating, review_count, booking_count, host_tier, status, created_at")
      .eq("status", "active")
      .range(offset, offset + limit - 1);

    if (vehicleType !== "all") query = query.eq("vehicle_type", vehicleType);
    if (instantBook === "true") query = query.eq("instant_book", true);
    if (transmission) query = query.eq("transmission", transmission);
    if (q) query = query.or(`make.ilike.%${q}%,model.ilike.%${q}%,location.ilike.%${q}%`);
    if (countryPat) query = query.ilike("location", countryPat);
    if (minPrice) query = query.gte("daily_rate_pi", parseFloat(minPrice));
    if (maxPrice) query = query.lte("daily_rate_pi", parseFloat(maxPrice));

    // Filter by availability if dates provided
    if (startDate && endDate) {
      const { data: bookedVehicleIds } = await supabase
        .from("endoro_bookings")
        .select("vehicle_id")
        .in("status", ["approved", "active"])
        .lte("start_date", endDate)
        .gte("end_date", startDate);

      const blocked = (bookedVehicleIds ?? []).map((b: any) => b.vehicle_id);
      if (blocked.length > 0) {
        query = query.not("id", "in", `(${blocked.join(",")})`);
      }
    }

    if (sort === "popular")    query = query.order("booking_count", { ascending: false });
    else if (sort === "rating") query = query.order("rating", { ascending: false });
    else if (sort === "newest") query = query.order("created_at", { ascending: false });
    else if (sort === "price_asc")  query = query.order("daily_rate_pi", { ascending: true });
    else if (sort === "price_desc") query = query.order("daily_rate_pi", { ascending: false });

    const { data: vehicles } = await query;
    const enriched = await enrichVehicles(vehicles ?? []);
    return NextResponse.json({ success: true, data: { vehicles: enriched } });

  } catch (err: any) {
    console.error("[endoro GET]", err);
    return NextResponse.json({ success: true, data: { featured: [], topRated: [], stats: {} } });
  }
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  // ── Create vehicle listing ──
  if (action === "create_vehicle") {
    const {
      vehicle_type, make, model, year, color, seats, transmission, fuel_type,
      images, description, location, lat, lng,
      instant_book, delivery_available, delivery_fee_pi,
      deposit_pi, hourly_rate_pi, daily_rate_pi, weekly_rate_pi, monthly_rate_pi,
      mileage_limit_day, excess_per_km_pi, min_rental_hours, rules,
    } = body;

    if (!make?.trim() || !model?.trim()) return NextResponse.json({ success: false, error: "Make and model required" }, { status: 400 });
    if (!daily_rate_pi || parseFloat(daily_rate_pi) <= 0) return NextResponse.json({ success: false, error: "Daily rate required" }, { status: 400 });

    const { data, error } = await supabase.from("endoro_vehicles").insert({
      host_id: userId,
      vehicle_type: vehicle_type ?? "car",
      make, model, year: year ?? null,
      color: color ?? "", seats: seats ?? 5,
      transmission: transmission ?? "automatic",
      fuel_type: fuel_type ?? "petrol",
      images: images ?? [], description: description ?? "",
      location: location ?? "", lat: lat ?? null, lng: lng ?? null,
      instant_book: instant_book ?? false,
      delivery_available: delivery_available ?? false,
      delivery_fee_pi: delivery_fee_pi ?? 0,
      deposit_pi: deposit_pi ?? 0,
      hourly_rate_pi: hourly_rate_pi ?? null,
      daily_rate_pi: parseFloat(daily_rate_pi),
      weekly_rate_pi: weekly_rate_pi ?? null,
      monthly_rate_pi: monthly_rate_pi ?? null,
      mileage_limit_day: mileage_limit_day ?? null,
      excess_per_km_pi: excess_per_km_pi ?? 0,
      min_rental_hours: min_rental_hours ?? 24,
      rules: rules ?? [],
    }).select().single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    // SC reward first listing
    try {
      const { count } = await supabase.from("endoro_vehicles").select("id", { count: "exact", head: true }).eq("host_id", userId);
      if (count === 1) {
        await supabase.from("supapi_credits").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
        const { data: wallet } = await supabase.from("supapi_credits").select("balance, total_earned").eq("user_id", userId).single();
        if (wallet) {
          await supabase.from("supapi_credits").update({ balance: wallet.balance + 150, total_earned: wallet.total_earned + 150 }).eq("user_id", userId);
          await supabase.from("credit_transactions").insert({ user_id: userId, type: "earn", activity: "endoro_first_listing", amount: 150, balance_after: wallet.balance + 150, note: "🚗 First Endoro vehicle listed!" });
        }
      }
    } catch {}

    return NextResponse.json({ success: true, data });
  }

  // ── Request booking ──
  if (action === "request_booking") {
    const { vehicle_id, start_date, end_date, pickup_type, delivery_address } = body;

    const { data: vehicle } = await supabase.from("endoro_vehicles")
      .select("id, host_id, daily_rate_pi, deposit_pi, delivery_fee_pi, instant_book, status")
      .eq("id", vehicle_id).single();

    if (!vehicle || vehicle.status !== "active") return NextResponse.json({ success: false, error: "Vehicle not available" }, { status: 400 });
    if (vehicle.host_id === userId) return NextResponse.json({ success: false, error: "Cannot book your own vehicle" }, { status: 400 });

    const start   = new Date(start_date);
    const end     = new Date(end_date);
    const days    = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    const rental  = parseFloat(vehicle.daily_rate_pi) * days;
    const deposit = parseFloat(vehicle.deposit_pi ?? 0);
    const delivery = pickup_type === "delivery" ? parseFloat(vehicle.delivery_fee_pi ?? 0) : 0;
    const fee     = rental * 0.05;
    const total   = rental + deposit + delivery;

    const { data, error } = await supabase.from("endoro_bookings").insert({
      vehicle_id,
      host_id: vehicle.host_id,
      renter_id: userId,
      start_date, end_date,
      pickup_type: pickup_type ?? "self",
      delivery_address: delivery_address ?? "",
      total_days: days,
      rental_pi: rental,
      deposit_pi: deposit,
      delivery_fee_pi: delivery,
      platform_fee_pi: fee,
      total_pi: total,
      status: vehicle.instant_book ? "approved" : "pending",
    }).select().single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    // Block dates in availability
    const blockedDates = [];
    const cur = new Date(start);
    while (cur <= end) {
      blockedDates.push({ vehicle_id, blocked_date: cur.toISOString().split("T")[0], reason: "booked" });
      cur.setDate(cur.getDate() + 1);
    }
    if (blockedDates.length > 0) {
      await supabase.from("endoro_availability").upsert(blockedDates, { onConflict: "vehicle_id,blocked_date", ignoreDuplicates: true });
    }

    return NextResponse.json({ success: true, data, instantly_booked: vehicle.instant_book });
  }

  // ── Toggle save ──
  if (action === "toggle_save") {
    const { vehicle_id } = body;
    const { data: existing } = await supabase.from("endoro_saved").select("id").eq("user_id", userId).eq("vehicle_id", vehicle_id).maybeSingle();
    if (existing) {
      await supabase.from("endoro_saved").delete().eq("user_id", userId).eq("vehicle_id", vehicle_id);
      const { data: v } = await supabase.from("endoro_vehicles").select("save_count").eq("id", vehicle_id).single();
      if (v) await supabase.from("endoro_vehicles").update({ save_count: Math.max(0, v.save_count - 1) }).eq("id", vehicle_id);
      return NextResponse.json({ success: true, saved: false });
    } else {
      await supabase.from("endoro_saved").insert({ user_id: userId, vehicle_id });
      const { data: v } = await supabase.from("endoro_vehicles").select("save_count").eq("id", vehicle_id).single();
      if (v) await supabase.from("endoro_vehicles").update({ save_count: v.save_count + 1 }).eq("id", vehicle_id);
      return NextResponse.json({ success: true, saved: true });
    }
  }

  // ── Update booking status ──
  if (action === "update_booking") {
    const { booking_id, status } = body;
    const { data: booking } = await supabase.from("endoro_bookings").select("host_id, renter_id, vehicle_id").eq("id", booking_id).single();
    if (!booking) return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 });
    if (booking.host_id !== userId && booking.renter_id !== userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });

    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === "approved")  updates.approved_at  = new Date().toISOString();
    if (status === "active")    updates.picked_up_at = new Date().toISOString();
    if (status === "completed") updates.returned_at  = new Date().toISOString();

    await supabase.from("endoro_bookings").update(updates).eq("id", booking_id);

    // SC reward on completion
    if (status === "completed") {
      for (const [uid, role] of [[booking.host_id, "host"], [booking.renter_id, "renter"]] as [string, string][]) {
        const sc = role === "host" ? 100 : 50;
        try {
          await supabase.from("supapi_credits").upsert({ user_id: uid }, { onConflict: "user_id", ignoreDuplicates: true });
          const { data: wallet } = await supabase.from("supapi_credits").select("balance, total_earned").eq("user_id", uid).single();
          if (wallet) {
            await supabase.from("supapi_credits").update({ balance: wallet.balance + sc, total_earned: wallet.total_earned + sc }).eq("user_id", uid);
            await supabase.from("credit_transactions").insert({ user_id: uid, type: "earn", activity: `endoro_booking_completed_${role}`, amount: sc, balance_after: wallet.balance + sc, note: `🚗 Endoro rental completed as ${role}!` });
          }
        } catch {}
      }

      // Update vehicle booking count
      const { data: veh } = await supabase.from("endoro_vehicles").select("booking_count").eq("id", booking.vehicle_id).single();
      if (veh) await supabase.from("endoro_vehicles").update({ booking_count: veh.booking_count + 1 }).eq("id", booking.vehicle_id);
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
}
