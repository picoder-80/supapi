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

// PATCH /api/locator/[id] — edit listing, reset to pending
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = getUser(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  // Verify ownership
  const { data: existing } = await supabase
    .from("businesses").select("owner_id").eq("id", id).single();
  if (!existing) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  if (String(existing.owner_id) !== String(user.userId)) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, category, description, address, city, state, country, lat, lng, phone, website, pi_wallet, image_url, images } = body;

  const { error } = await supabase
    .from("businesses")
    .update({
      name, category, description, address, city, state, country,
      lat: lat ?? null, lng: lng ?? null,
      phone, website, pi_wallet, image_url,
      images: images ?? [],
      status: "pending",      // back to pending after edit
      verified: false,         // unverify until re-approved
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

  // Verify ownership
  const { data: existing } = await supabase
    .from("businesses").select("owner_id").eq("id", id).single();
  if (!existing) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  if (String(existing.owner_id) !== String(user.userId)) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const { error } = await supabase.from("businesses").delete().eq("id", id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}