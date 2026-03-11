// src/app/api/pioneers/route.ts
// GET  /api/pioneers         — fetch all visible pins + groups
// POST /api/pioneers         — pin/update self on map
// DELETE /api/pioneers       — remove own pin

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat    = parseFloat(searchParams.get("lat") ?? "0");
  const lng    = parseFloat(searchParams.get("lng") ?? "0");
  const radius = parseFloat(searchParams.get("radius") ?? "50"); // km

  try {
    // Fetch visible pins
    const { data: pins } = await supabase
      .from("pioneer_pins")
      .select("id, user_id, lat, lng, precision, status, note, visible_to")
      .neq("visible_to", "nobody")
      .neq("status", "hidden")
      .limit(500);

    if (!pins) return NextResponse.json({ success: true, data: { pins: [], users: {}, groups: [] } });

    // Enrich with user profiles
    const userIds = [...new Set(pins.map((p: any) => p.user_id))];
    let usersMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, username, display_name, avatar_url, kyc_status, bio, created_at")
        .in("id", userIds);
      (users ?? []).forEach((u: any) => { usersMap[u.id] = u; });
    }

    // Apply precision blur for non-exact pins
    const processedPins = pins.map((pin: any) => {
      let { lat: pLat, lng: pLng } = pin;
      if (pin.precision === "district") {
        // Blur to ~2km grid
        pLat = Math.round(pLat * 50) / 50;
        pLng = Math.round(pLng * 50) / 50;
      } else if (pin.precision === "state") {
        // Blur to ~20km grid
        pLat = Math.round(pLat * 5) / 5;
        pLng = Math.round(pLng * 5) / 5;
      }
      // Filter by radius if coords given
      if (lat && lng && radius) {
        const dist = Math.sqrt(
          Math.pow((pLat - lat) * 111, 2) +
          Math.pow((pLng - lng) * 111 * Math.cos(lat * Math.PI / 180), 2)
        );
        if (dist > radius) return null;
      }
      return { ...pin, lat: pLat, lng: pLng };
    }).filter(Boolean);

    // Fetch groups
    const { data: groups } = await supabase
      .from("pioneer_groups")
      .select("id, name, description, lat, lng, location, cover_emoji, member_count, is_public, created_at")
      .eq("is_public", true)
      .order("member_count", { ascending: false })
      .limit(100);

    return NextResponse.json({
      success: true,
      data: { pins: processedPins, users: usersMap, groups: groups ?? [] }
    });
  } catch (err: any) {
    console.error("[pioneers GET]", err);
    return NextResponse.json({ success: true, data: { pins: [], users: {}, groups: [] } });
  }
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { lat, lng, precision, status, visible_to, note } = await req.json();

  if (!lat || !lng) return NextResponse.json({ success: false, error: "Location required" }, { status: 400 });

  const { data, error } = await supabase
    .from("pioneer_pins")
    .upsert({
      user_id:    userId,
      lat:        parseFloat(lat),
      lng:        parseFloat(lng),
      precision:  precision  ?? "district",
      status:     status     ?? "active",
      visible_to: visible_to ?? "everyone",
      note:       note       ?? "",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await supabase.from("pioneer_pins").delete().eq("user_id", userId);
  return NextResponse.json({ success: true });
}
