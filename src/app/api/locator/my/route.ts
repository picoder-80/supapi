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

// GET /api/locator/my — get my listings
export async function GET(req: Request) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("businesses")
    .select("id,name,category,description,address,city,state,country,lat,lng,phone,website,pi_wallet,image_url,images,status,verified,avg_rating,review_count,opening_hours,created_at,updated_at")
    .eq("owner_id", user.userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data: data ?? [] });
}