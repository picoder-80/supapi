import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getUserId(req: Request): string | null {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return String(decoded.userId ?? decoded.id ?? decoded.sub ?? "");
  } catch { return null; }
}

// PATCH /api/locator/[id] — edit, reset to pending
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: biz, error: fetchErr } = await supabase
    .from("businesses").select("owner_id").eq("id", id).single();
  if (fetchErr || !biz) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (String(biz.owner_id) !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const hours = Array.isArray(body.opening_hours) && body.opening_hours.length >= 7
    ? body.opening_hours.slice(0, 7)
    : DAYS.map(d => ({ day: d, time: "" }));

  const { error } = await supabase.from("businesses").update({
    name:        body.name,
    category:    body.category,
    description: body.description || null,
    address:     body.address,
    city:        body.city,
    state:       body.state || null,
    country:     body.country || "United States",
    lat:         body.lat ? parseFloat(body.lat) : null,
    lng:         body.lng ? parseFloat(body.lng) : null,
    phone:       body.phone || null,
    website:     body.website || null,
    pi_wallet:   body.pi_wallet || null,
    image_url:   body.image_url || null,
    images:      body.images ?? [],
    opening_hours: hours,
    status:      "pending",
    verified:    false,
    updated_at:  new Date().toISOString(),
  }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/locator/[id]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: biz, error: fetchErr } = await supabase
    .from("businesses").select("owner_id").eq("id", id).single();
  if (fetchErr || !biz) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (String(biz.owner_id) !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase.from("businesses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
