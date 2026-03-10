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
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return decoded;
  } catch { return null; }
}

// PATCH /api/locator/[id] — edit listing, reset to pending
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = getUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const userId = user.userId ?? user.id ?? user.sub;
  if (!userId) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

  // Verify ownership
  const { data: existing, error: fetchErr } = await supabase
    .from("businesses").select("owner_id").eq("id", id).single();
  if (fetchErr || !existing) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  if (String(existing.owner_id) !== String(userId)) {
    return NextResponse.json({ success: false, error: "Forbidden", debug: { owner: existing.owner_id, user: userId } }, { status: 403 });
  }

  const body = await req.json();
  const { name, category, description, address, city, state, country, lat, lng, phone, website, pi_wallet, image_url, images } = body;

  const { error } = await supabase
    .from("businesses")
    .update({
      name, category, description, address, city, state, country,
      lat: lat ? parseFloat(String(lat)) : null,
      lng: lng ? parseFloat(String(lng)) : null,
      phone: phone || null,
      website: website || null,
      pi_wallet: pi_wallet || null,
      image_url: image_url || null,
      images: images ?? [],
      status: "pending",
      verified: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/locator/[id] — delete own listing
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = getUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const userId = user.userId ?? user.id ?? user.sub;
  if (!userId) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

  // Verify ownership
  const { data: existing, error: fetchErr } = await supabase
    .from("businesses").select("owner_id").eq("id", id).single();
  if (fetchErr || !existing) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  if (String(existing.owner_id) !== String(userId)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("businesses").delete().eq("id", id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}