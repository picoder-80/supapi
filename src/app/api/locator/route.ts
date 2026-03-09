import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getUser(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
  } catch { return null; }
}

// GET /api/locator?category=food&city=KL&q=mamak&lat=3.1&lng=101.6
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const city     = searchParams.get("city");
  const q        = searchParams.get("q");
  const lat      = parseFloat(searchParams.get("lat") ?? "0");
  const lng      = parseFloat(searchParams.get("lng") ?? "0");
  const page     = parseInt(searchParams.get("page") ?? "1");
  const limit    = 20;

  let query = supabase
    .from("businesses")
    .select("id,name,category,description,address,city,country,lat,lng,phone,website,image_url,verified,avg_rating,review_count,created_at")
    .eq("status", "approved")
    .order("verified", { ascending: false })
    .order("avg_rating", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (category && category !== "all") query = query.eq("category", category);
  if (city) query = query.ilike("city", `%${city}%`);
  if (q)    query = query.ilike("name", `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Sort by distance if coords given
  let results = data ?? [];
  if (lat && lng) {
    results = results
      .map(b => ({
        ...b,
        distance: b.lat && b.lng
          ? Math.sqrt(Math.pow((b.lat - lat) * 111, 2) + Math.pow((b.lng - lng) * 111 * Math.cos(lat * Math.PI / 180), 2))
          : 9999,
      }))
      .sort((a, b) => a.distance - b.distance);
  }

  return NextResponse.json({ success: true, data: results });
}

// POST /api/locator — submit new business
export async function POST(req: Request) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, category, description, address, city, state, country, lat, lng, phone, website, pi_wallet, image_url } = body;

  if (!name || !category || !address || !city) {
    return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("businesses")
    .insert({
      owner_id: user.userId,
      name, category, description, address, city, state,
      country: country || "Malaysia",
      lat: lat || null, lng: lng || null,
      phone, website, pi_wallet, image_url,
      status: "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}