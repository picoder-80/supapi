import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

type Params = { params: Promise<{ id: string }> };

// GET — single listing detail (optionally includes liked when Authorization present)
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createAdminClient();

    // Increment view count (best-effort)
    try { await supabase.rpc("increment_listing_views", { listing_id: id }); } catch {}

    const { data, error } = await supabase
      .from("listings")
      .select(`
        *, seller:seller_id ( id, username, display_name, avatar_url, kyc_status, created_at )
      `)
      .eq("id", id)
      .single();

    if (error || !data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    const payload = auth ? verifyToken(auth) : null;
    let liked = false;
    if (payload?.userId) {
      const { data: likeRow } = await supabase
        .from("listing_likes")
        .select("id")
        .eq("listing_id", id)
        .eq("user_id", payload.userId)
        .maybeSingle();
      liked = !!likeRow;
    }

    return NextResponse.json({ success: true, data: { ...data, liked } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// PATCH — update listing (seller only)
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const body = await req.json();
    const allowed = ["title","description","price_pi","category","subcategory",
                     "condition","buying_method","images","stock","location","status","type",
                     "country_code","ship_worldwide"];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) { if (key in body) updates[key] = body[key]; }

    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("listings")
      .update(updates)
      .eq("id", id)
      .eq("seller_id", payload.userId) // only own listings
      .select().single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// DELETE — soft delete
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const supabase = await createAdminClient();
    await supabase.from("listings")
      .update({ status: "deleted", updated_at: new Date().toISOString() })
      .eq("id", id).eq("seller_id", payload.userId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
